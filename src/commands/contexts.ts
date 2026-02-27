import { defineCommand } from "@crustjs/core";
import type { ContextShareRequest, ContextShareUpdateRequest } from "nia-ai-ts";
import { V2ApiContextsService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { handleError } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";
import { createSpinner } from "../utils/spinner.ts";

/**
 * Valid memory types for context sharing.
 */
const VALID_MEMORY_TYPES = ["scratchpad", "episodic", "fact", "procedural"] as const;

/**
 * Validate memory type against allowed values.
 * Returns the validated value or exits with an error.
 */
function validateMemoryType(value: string): "scratchpad" | "episodic" | "fact" | "procedural" {
	if (!VALID_MEMORY_TYPES.includes(value as (typeof VALID_MEMORY_TYPES)[number])) {
		console.error(`Invalid memory type: "${value}". Allowed: ${VALID_MEMORY_TYPES.join(", ")}`);
		process.exit(1);
	}
	return value as "scratchpad" | "episodic" | "fact" | "procedural";
}

/**
 * Read content from stdin (for piping content via --content '-').
 */
async function readStdin(): Promise<string> {
	const chunks: Uint8Array[] = [];
	const reader = process.stdin;

	return new Promise((resolve, reject) => {
		reader.on("data", (chunk: Buffer) => {
			chunks.push(chunk);
		});
		reader.on("end", () => {
			resolve(Buffer.concat(chunks).toString("utf-8"));
		});
		reader.on("error", reject);
	});
}

// --- Subcommands ---

const saveCommand = defineCommand({
	meta: {
		name: "save",
		description: "Save a new cross-agent context",
	},
	args: [
		{
			name: "title",
			type: "string",
			description: "Title for the context",
			required: true,
		},
	] as const,
	flags: {
		summary: {
			type: "string",
			description: "Brief summary of the context (required)",
			required: true,
		},
		content: {
			type: "string",
			description: "Full content of the context (required, use '-' to read from stdin)",
			required: true,
		},
		agent: {
			type: "string",
			description: "Agent source identifier (required)",
			required: true,
		},
		tags: {
			type: "string",
			description: "Comma-separated tags for categorization",
		},
		"memory-type": {
			type: "string",
			description: "Memory type: scratchpad, episodic, fact, procedural",
		},
		ttl: {
			type: "number",
			description: "Time-to-live in seconds",
		},
		workspace: {
			type: "string",
			description: "Workspace identifier",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		// Validate memory type if provided
		if (flags["memory-type"]) {
			validateMemoryType(flags["memory-type"]);
		}

		// Resolve content — read from stdin if '--content -'
		let content = flags.content;
		if (content === "-") {
			content = await readStdin();
			if (!content.trim()) {
				fmt.error("No content received from stdin.");
				process.exit(1);
			}
		}

		spinner.start("Saving context...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const payload: ContextShareRequest = {
				title: args.title,
				summary: flags.summary,
				content,
				agent_source: flags.agent,
			};

			if (flags.tags) {
				payload.tags = flags.tags.split(",").map((s) => s.trim());
			}
			if (flags["memory-type"]) {
				payload.memory_type = flags["memory-type"] as ContextShareRequest["memory_type"];
			}
			if (flags.ttl !== undefined) {
				payload.ttl_seconds = flags.ttl;
			}

			const result = await V2ApiContextsService.saveContextV2V2ContextsPost(payload);

			spinner.stop("Context saved");

			if (global.output !== "json") {
				const ctx = result as Record<string, unknown>;
				console.log(`Context ID: ${ctx.id ?? "unknown"}`);
				console.log(`Title:      ${ctx.title ?? args.title}`);
				if (ctx.memory_type) {
					console.log(`Type:       ${ctx.memory_type}`);
				}
				if (ctx.expires_at) {
					console.log(`Expires:    ${ctx.expires_at}`);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to save context");
			handleError(error, { domain: "Context" });
		}
	},
});

const listCommand = defineCommand({
	meta: {
		name: "list",
		description: "List contexts with pagination and filtering",
	},
	args: [],
	flags: {
		limit: {
			type: "number",
			description: "Maximum number of contexts to return",
		},
		offset: {
			type: "number",
			description: "Number of contexts to skip (for pagination)",
		},
		tags: {
			type: "string",
			description: "Filter by tags (comma-separated)",
		},
		agent: {
			type: "string",
			description: "Filter by agent source",
		},
		"memory-type": {
			type: "string",
			description: "Filter by memory type: scratchpad, episodic, fact, procedural",
		},
	},
	async run({ flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		// Validate memory type if provided
		if (flags["memory-type"]) {
			validateMemoryType(flags["memory-type"]);
		}

		spinner.start("Fetching contexts...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await V2ApiContextsService.listContextsV2V2ContextsGet(
				flags.limit ?? undefined,
				flags.offset ?? undefined,
				flags.tags ?? undefined,
				flags.agent ?? undefined,
				flags["memory-type"] ?? undefined,
			);

			spinner.stop("Contexts retrieved");

			// In text/table mode, format as a table
			if (global.output !== "json") {
				const response = result as Record<string, unknown>;
				const items = (response.items ?? response.contexts ?? []) as Array<Record<string, unknown>>;

				if (items.length === 0) {
					console.log("No contexts found.");
				} else {
					const rows = items.map((ctx) => ({
						id: String(ctx.id ?? ""),
						title:
							String(ctx.title ?? "").length > 40
								? `${String(ctx.title ?? "").slice(0, 37)}...`
								: String(ctx.title ?? ""),
						agent_source: String(ctx.agent_source ?? ""),
						memory_type: String(ctx.memory_type ?? ""),
						created_at: String(ctx.created_at ?? ""),
					}));
					fmt.output(rows);
				}

				// Show pagination info
				const pagination = response.pagination as Record<string, unknown> | undefined;
				if (pagination) {
					const total = pagination.total ?? response.total;
					const hasMore = pagination.has_more;
					if (total !== undefined) {
						console.log(`\nTotal: ${total}${hasMore ? " (more available)" : ""}`);
					}
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to fetch contexts");
			handleError(error, { domain: "Context" });
		}
	},
});

const searchCommand = defineCommand({
	meta: {
		name: "search",
		description: "Search contexts by text (title, summary, content, tags)",
	},
	args: [
		{
			name: "query",
			type: "string",
			description: "Search query",
			required: true,
		},
	] as const,
	flags: {
		limit: {
			type: "number",
			description: "Maximum number of results to return",
		},
		tags: {
			type: "string",
			description: "Filter by tags (comma-separated)",
		},
		agent: {
			type: "string",
			description: "Filter by agent source",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Searching contexts...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await V2ApiContextsService.searchContextsV2V2ContextsSearchGet(
				args.query,
				flags.limit ?? undefined,
				flags.tags ?? undefined,
				flags.agent ?? undefined,
			);

			spinner.stop("Search complete");

			if (global.output !== "json") {
				const response = result as Record<string, unknown>;
				const contexts = (response.contexts ?? []) as Array<Record<string, unknown>>;

				if (contexts.length === 0) {
					console.log("No matching contexts found.");
				} else {
					const rows = contexts.map((ctx) => ({
						id: String(ctx.id ?? ""),
						title:
							String(ctx.title ?? "").length > 40
								? `${String(ctx.title ?? "").slice(0, 37)}...`
								: String(ctx.title ?? ""),
						agent_source: String(ctx.agent_source ?? ""),
						memory_type: String(ctx.memory_type ?? ""),
					}));
					fmt.output(rows);

					if (response.total_results !== undefined) {
						console.log(`\nTotal results: ${response.total_results}`);
					}
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Search failed");
			handleError(error, { domain: "Context" });
		}
	},
});

const semanticCommand = defineCommand({
	meta: {
		name: "semantic",
		description: "Semantic (vector + BM25 hybrid) search over contexts",
	},
	args: [
		{
			name: "query",
			type: "string",
			description: "Semantic search query",
			required: true,
		},
	] as const,
	flags: {
		limit: {
			type: "number",
			description: "Maximum number of results to return",
		},
		highlights: {
			type: "boolean",
			description: "Include highlight snippets in results",
		},
		workspace: {
			type: "string",
			description: "Filter by workspace",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Running semantic search...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await V2ApiContextsService.semanticSearchContextsV2V2ContextsSemanticSearchGet(
				args.query,
				flags.limit ?? undefined,
				flags.highlights ?? undefined,
				flags.workspace ?? undefined,
			);

			spinner.stop("Semantic search complete");

			if (global.output !== "json") {
				const response = result as Record<string, unknown>;
				const results = (response.results ?? []) as Array<Record<string, unknown>>;

				if (results.length === 0) {
					console.log("No matching contexts found.");
				} else {
					const rows = results.map((item) => ({
						id: String(item.id ?? ""),
						title:
							String(item.title ?? "").length > 40
								? `${String(item.title ?? "").slice(0, 37)}...`
								: String(item.title ?? ""),
						score: item.score !== undefined ? String(item.score) : "",
						agent_source: String(item.agent_source ?? ""),
					}));
					fmt.output(rows);
				}

				// Show search metadata
				const metadata = response.search_metadata as Record<string, unknown> | undefined;
				if (metadata) {
					const parts: string[] = [];
					if (metadata.total_results !== undefined) {
						parts.push(`Total: ${metadata.total_results}`);
					}
					if (metadata.search_type) {
						parts.push(`Type: ${metadata.search_type}`);
					}
					if (parts.length > 0) {
						console.log(`\n${parts.join(" | ")}`);
					}
				}

				// Show suggestions
				const suggestions = response.suggestions as Record<string, unknown> | undefined;
				if (suggestions) {
					const tips = suggestions.tips as string[] | undefined;
					if (tips && tips.length > 0) {
						console.log(`\nTips: ${tips.join("; ")}`);
					}
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Semantic search failed");
			handleError(error, { domain: "Context" });
		}
	},
});

const getCommand = defineCommand({
	meta: {
		name: "get",
		description: "Retrieve a specific context by ID",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Context ID",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Fetching context...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await V2ApiContextsService.getContextV2V2ContextsContextIdGet(args.id);

			spinner.stop("Context retrieved");

			if (global.output !== "json") {
				const ctx = result as Record<string, unknown>;
				console.log(`ID:           ${ctx.id ?? args.id}`);
				console.log(`Title:        ${ctx.title ?? ""}`);
				console.log(`Summary:      ${ctx.summary ?? ""}`);
				console.log(`Agent:        ${ctx.agent_source ?? ""}`);
				if (ctx.memory_type) {
					console.log(`Memory Type:  ${ctx.memory_type}`);
				}
				if (ctx.tags && Array.isArray(ctx.tags) && ctx.tags.length > 0) {
					console.log(`Tags:         ${ctx.tags.join(", ")}`);
				}
				if (ctx.created_at) {
					console.log(`Created:      ${ctx.created_at}`);
				}
				if (ctx.updated_at) {
					console.log(`Updated:      ${ctx.updated_at}`);
				}
				if (ctx.expires_at) {
					console.log(`Expires:      ${ctx.expires_at}`);
				}
				if (ctx.content) {
					console.log("\n--- Content ---");
					console.log(String(ctx.content));
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to fetch context");
			handleError(error, { domain: "Context" });
		}
	},
});

const updateCommand = defineCommand({
	meta: {
		name: "update",
		description: "Update an existing context",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Context ID to update",
			required: true,
		},
	] as const,
	flags: {
		title: {
			type: "string",
			description: "New title",
		},
		summary: {
			type: "string",
			description: "New summary",
		},
		content: {
			type: "string",
			description: "New content (use '-' to read from stdin)",
		},
		tags: {
			type: "string",
			description: "New tags (comma-separated, replaces existing)",
		},
		"memory-type": {
			type: "string",
			description: "New memory type: scratchpad, episodic, fact, procedural",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		// Validate memory type if provided
		if (flags["memory-type"]) {
			validateMemoryType(flags["memory-type"]);
		}

		// Build update payload — at least one field must be provided
		const payload: ContextShareUpdateRequest = {};
		let hasUpdate = false;

		if (flags.title) {
			payload.title = flags.title;
			hasUpdate = true;
		}
		if (flags.summary) {
			payload.summary = flags.summary;
			hasUpdate = true;
		}
		if (flags.content) {
			let content = flags.content;
			if (content === "-") {
				content = await readStdin();
				if (!content.trim()) {
					fmt.error("No content received from stdin.");
					process.exit(1);
				}
			}
			payload.content = content;
			hasUpdate = true;
		}
		if (flags.tags) {
			payload.tags = flags.tags.split(",").map((s) => s.trim());
			hasUpdate = true;
		}
		if (flags["memory-type"]) {
			payload.memory_type = flags["memory-type"] as ContextShareUpdateRequest["memory_type"];
			hasUpdate = true;
		}

		if (!hasUpdate) {
			fmt.error(
				"No update fields provided. Use --title, --summary, --content, --tags, or --memory-type.",
			);
			process.exit(1);
		}

		spinner.start("Updating context...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await V2ApiContextsService.updateContextV2V2ContextsContextIdPut(
				args.id,
				payload,
			);

			spinner.stop("Context updated");

			if (global.output !== "json") {
				const ctx = result as Record<string, unknown>;
				console.log(`Context ${ctx.id ?? args.id} updated successfully.`);
				if (ctx.title) {
					console.log(`Title: ${ctx.title}`);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to update context");
			handleError(error, { domain: "Context" });
		}
	},
});

const deleteCommand = defineCommand({
	meta: {
		name: "delete",
		description: "Delete a context (soft delete)",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Context ID to delete",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Deleting context...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await V2ApiContextsService.deleteContextV2V2ContextsContextIdDelete(args.id);

			spinner.stop("Context deleted");

			if (global.output === "json") {
				fmt.output(result);
			} else {
				console.log(`Context ${args.id} has been deleted.`);
			}
		} catch (error) {
			spinner.stop("Failed to delete context");
			handleError(error, { domain: "Context" });
		}
	},
});

export const contextsCommand = defineCommand({
	meta: {
		name: "contexts",
		description: "Save and search cross-agent contexts",
	},
	subCommands: {
		save: saveCommand,
		list: listCommand,
		search: searchCommand,
		semantic: semanticCommand,
		get: getCommand,
		update: updateCommand,
		delete: deleteCommand,
	},
});
