import { defineCommand } from "@crustjs/core";
import { V2ApiDataSourcesService, V2ApiSourcesService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";
import { createSpinner } from "../utils/spinner.ts";

/**
 * Valid source type values accepted by the API.
 */
const SOURCE_TYPES = [
	"repository",
	"documentation",
	"research_paper",
	"huggingface_dataset",
	"local_folder",
] as const;

type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Shared error handler for sources commands.
 * Maps common SDK errors to user-friendly messages.
 */
function handleSourcesError(error: unknown): never {
	const status = (error as { status?: number }).status;
	const message = (error as Error).message ?? String(error);

	if (status === 401 || status === 403) {
		console.error("Authentication failed — run `nia auth login` to authenticate.");
	} else if (status === 404) {
		console.error("Source not found. Check the source ID and try again.");
	} else if (status === 422) {
		console.error(`Validation error: ${message}`);
	} else if (status === 429) {
		console.error("Rate limited — try again in a moment.");
	} else if (status && status >= 500) {
		console.error(`Server error (${status}) — try again later.`);
	} else {
		console.error(`Operation failed: ${message}`);
	}

	process.exit(1);
}

/**
 * Validate a source type flag value.
 * Returns the validated type or undefined if not provided.
 */
function validateSourceType(type: string | undefined): SourceType | undefined {
	if (!type) return undefined;
	if (SOURCE_TYPES.includes(type as SourceType)) {
		return type as SourceType;
	}
	console.error(`Invalid source type: "${type}". Allowed: ${SOURCE_TYPES.join(", ")}`);
	process.exit(1);
}

// --- Subcommands ---

const indexCommand = defineCommand({
	meta: {
		name: "index",
		description: "Index a documentation URL or website as a source",
	},
	args: [
		{
			name: "url",
			type: "string",
			description: "URL to index",
			required: true,
		},
	] as const,
	flags: {
		name: {
			type: "string",
			description: "Display name for the source",
		},
		branch: {
			type: "string",
			description: "Git branch to index",
		},
		focus: {
			type: "string",
			description: "Focus instructions for LLM filtering",
		},
		"extract-branding": {
			type: "boolean",
			description: "Extract branding information",
		},
		"max-depth": {
			type: "number",
			description: "Maximum crawl depth (default: 20)",
		},
		"check-llms-txt": {
			type: "boolean",
			description: "Check for llms.txt file (default: true)",
		},
		"only-main-content": {
			type: "boolean",
			description: "Extract only main content, skip navigation/footer",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Indexing source...");

		try {
			const sdk = await createSdk({ apiKey: global.apiKey });

			const params: Record<string, unknown> = {
				url: args.url,
			};

			if (flags.name) {
				params.display_name = flags.name;
			}
			if (flags.branch) {
				params.branch = flags.branch;
			}
			if (flags.focus) {
				params.focus_instructions = flags.focus;
			}
			if (flags["extract-branding"] !== undefined) {
				params.extract_branding = flags["extract-branding"];
			}
			if (flags["max-depth"] !== undefined) {
				params.max_depth = flags["max-depth"];
			}
			if (flags["check-llms-txt"] !== undefined) {
				params.check_llms_txt = flags["check-llms-txt"];
			}
			if (flags["only-main-content"] !== undefined) {
				params.only_main_content = flags["only-main-content"];
			}

			const result = await sdk.sources.create(params);

			spinner.stop("Source indexed");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Indexing failed");
			handleSourcesError(error);
		}
	},
});

const listCommand = defineCommand({
	meta: {
		name: "list",
		description: "List indexed sources",
	},
	flags: {
		type: {
			type: "string",
			description: "Filter by type: repository, documentation, research_paper, huggingface_dataset",
		},
		query: {
			type: "string",
			description: "Search query to filter sources",
		},
		status: {
			type: "string",
			description: "Filter by indexing status",
		},
		category: {
			type: "string",
			description: "Filter by category ID",
		},
		limit: {
			type: "number",
			description: "Maximum number of results (default: 20)",
		},
		offset: {
			type: "number",
			description: "Offset for pagination",
		},
	},
	async run({ flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		const sourceType = validateSourceType(flags.type);

		spinner.start("Listing sources...");

		try {
			const sdk = await createSdk({ apiKey: global.apiKey });

			const result = await sdk.sources.list({
				type: sourceType,
				query: flags.query,
				status: flags.status,
				categoryId: flags.category,
				limit: flags.limit,
				offset: flags.offset,
			});

			spinner.stop("Sources retrieved");
			fmt.output(result);
		} catch (error) {
			spinner.stop("List failed");
			handleSourcesError(error);
		}
	},
});

const getCommand = defineCommand({
	meta: {
		name: "get",
		description: "Get details of a specific source",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Source ID",
			required: true,
		},
	] as const,
	flags: {
		type: {
			type: "string",
			description:
				"Source type hint: repository, documentation, research_paper, huggingface_dataset",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		const sourceType = validateSourceType(flags.type);

		spinner.start("Fetching source...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await V2ApiSourcesService.getSourceV2SourcesSourceIdGet(args.id, sourceType);

			spinner.stop("Source retrieved");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Fetch failed");
			handleSourcesError(error);
		}
	},
});

const resolveCommand = defineCommand({
	meta: {
		name: "resolve",
		description: "Resolve a source by name, URL, or slug",
	},
	args: [
		{
			name: "identifier",
			type: "string",
			description: "Source identifier (name, URL, or slug)",
			required: true,
		},
	] as const,
	flags: {
		type: {
			type: "string",
			description:
				"Source type hint: repository, documentation, research_paper, huggingface_dataset",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		const sourceType = validateSourceType(flags.type);

		spinner.start("Resolving source...");

		try {
			const sdk = await createSdk({ apiKey: global.apiKey });

			const result = await sdk.sources.resolve(args.identifier, sourceType);

			spinner.stop("Source resolved");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Resolve failed");
			handleSourcesError(error);
		}
	},
});

const updateCommand = defineCommand({
	meta: {
		name: "update",
		description: "Update a source's display name or category",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Source ID",
			required: true,
		},
	] as const,
	flags: {
		name: {
			type: "string",
			description: "New display name",
		},
		category: {
			type: "string",
			description: "Category ID to assign",
		},
		type: {
			type: "string",
			description:
				"Source type hint: repository, documentation, research_paper, huggingface_dataset",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		const sourceType = validateSourceType(flags.type);

		if (!flags.name && !flags.category) {
			fmt.error("Provide at least one of --name or --category to update.");
			process.exit(1);
		}

		spinner.start("Updating source...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const requestBody: Record<string, unknown> = {};
			if (flags.name) {
				requestBody.display_name = flags.name;
			}
			if (flags.category) {
				requestBody.category_id = flags.category;
			}

			const result = await V2ApiSourcesService.updateSourceV2SourcesSourceIdPatch(
				args.id,
				requestBody as Parameters<typeof V2ApiSourcesService.updateSourceV2SourcesSourceIdPatch>[1],
				sourceType,
			);

			spinner.stop("Source updated");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Update failed");
			handleSourcesError(error);
		}
	},
});

const deleteCommand = defineCommand({
	meta: {
		name: "delete",
		description: "Delete an indexed source",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Source ID",
			required: true,
		},
	] as const,
	flags: {
		type: {
			type: "string",
			description:
				"Source type hint: repository, documentation, research_paper, huggingface_dataset",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		const sourceType = validateSourceType(flags.type);

		spinner.start("Deleting source...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await V2ApiSourcesService.deleteSourceV2SourcesSourceIdDelete(
				args.id,
				sourceType,
			);

			spinner.stop("Source deleted");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Delete failed");
			handleSourcesError(error);
		}
	},
});

const syncCommand = defineCommand({
	meta: {
		name: "sync",
		description: "Re-index a source by resolving its URL and re-creating it",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Source ID",
			required: true,
		},
	] as const,
	flags: {
		type: {
			type: "string",
			description:
				"Source type hint: repository, documentation, research_paper, huggingface_dataset",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		const sourceType = validateSourceType(flags.type);

		spinner.start("Syncing source...");

		try {
			const sdk = await createSdk({ apiKey: global.apiKey });

			// Fetch the existing source to get its URL/identifier
			const source = await V2ApiSourcesService.getSourceV2SourcesSourceIdGet(args.id, sourceType);

			const url = source.identifier;
			if (!url) {
				spinner.stop("Sync failed");
				fmt.error("Could not determine the source URL. The source may not have an identifier.");
				process.exit(1);
			}

			// Re-index by creating with the same URL
			const result = await sdk.sources.create({
				url,
				display_name: source.display_name,
			});

			spinner.stop("Source synced (re-indexing started)");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Sync failed");
			handleSourcesError(error);
		}
	},
});

const renameCommand = defineCommand({
	meta: {
		name: "rename",
		description: "Rename a source by identifier (name, URL, or UUID)",
	},
	args: [
		{
			name: "identifier",
			type: "string",
			description: "Source identifier (name, URL, or UUID)",
			required: true,
		},
		{
			name: "new-name",
			type: "string",
			description: "New display name",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Renaming source...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await V2ApiDataSourcesService.renameDataSourceV2V2DataSourcesRenamePatch({
				identifier: args.identifier,
				new_name: args["new-name"],
			});

			spinner.stop("Source renamed");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Rename failed");
			handleSourcesError(error);
		}
	},
});

// --- Parent command ---

export const sourcesCommand = defineCommand({
	meta: {
		name: "sources",
		description: "Manage indexed documentation and data sources",
	},
	subCommands: {
		index: indexCommand,
		list: listCommand,
		get: getCommand,
		resolve: resolveCommand,
		update: updateCommand,
		delete: deleteCommand,
		sync: syncCommand,
		rename: renameCommand,
	},
});
