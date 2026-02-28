import { defineCommand } from "@crustjs/core";
import { spinner } from "@crustjs/prompts";
import type { GrepRequest } from "nia-ai-ts";
import { V2ApiDataSourcesService, V2ApiSourcesService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { handleError } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";
import {
	checkFirstRun,
	promptOptional,
	promptSelect,
	requireArg,
} from "../utils/prompts.ts";

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
 * Validate a source type flag value.
 * Returns the validated type or undefined if not provided.
 */
function validateSourceType(type: string | undefined): SourceType | undefined {
	if (!type) return undefined;
	if (SOURCE_TYPES.includes(type as SourceType)) {
		return type as SourceType;
	}
	console.error(
		`Invalid source type: "${type}". Allowed: ${SOURCE_TYPES.join(", ")}`,
	);
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
			description: "URL to index (prompted interactively if omitted in a TTY)",
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
		await checkFirstRun(global.apiKey);

		const fmt = createFormatter({ output: global.output, color: global.color });

		// Interactive mode: prompt for missing required arg and optional fields
		const url = await requireArg(args.url, {
			name: "url",
			message: "URL to index:",
			validate: (v) => {
				try {
					new URL(v);
					return true;
				} catch {
					return "Please enter a valid URL (e.g., https://docs.example.com)";
				}
			},
		});

		let displayName = flags.name;
		if (!displayName) {
			displayName =
				(await promptOptional({ message: "Display name (optional):" })) ??
				undefined;
		}

		const sourceType = await promptSelect({
			message: "Source type:",
			choices: [
				{ label: "Documentation", value: "documentation" as const },
				{ label: "Repository", value: "repository" as const },
				{ label: "Research Paper", value: "research_paper" as const },
				{ label: "HuggingFace Dataset", value: "huggingface_dataset" as const },
			],
		});

		try {
			const result = await spinner({
				message: "Indexing source...",
				task: async () => {
					const sdk = await createSdk({ apiKey: global.apiKey });

					const params: Record<string, unknown> = {
						url,
					};

					if (displayName) {
						params.display_name = displayName;
					}
					if (sourceType) {
						params.type = sourceType;
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

					return await sdk.sources.create(params);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Source" });
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
			description:
				"Filter by type: repository, documentation, research_paper, huggingface_dataset",
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

		const sourceType = validateSourceType(flags.type);

		try {
			const result = await spinner({
				message: "Listing sources...",
				task: async () => {
					const sdk = await createSdk({ apiKey: global.apiKey });

					return await sdk.sources.list({
						type: sourceType,
						query: flags.query,
						status: flags.status,
						categoryId: flags.category,
						limit: flags.limit,
						offset: flags.offset,
					});
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Source" });
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

		const sourceType = validateSourceType(flags.type);

		try {
			const result = await spinner({
				message: "Fetching source...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiSourcesService.getSourceV2SourcesSourceIdGet(
						args.id,
						sourceType,
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Source" });
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

		const sourceType = validateSourceType(flags.type);

		try {
			const result = await spinner({
				message: "Resolving source...",
				task: async () => {
					const sdk = await createSdk({ apiKey: global.apiKey });

					return await sdk.sources.resolve(args.identifier, sourceType);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Source" });
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

		const sourceType = validateSourceType(flags.type);

		if (!flags.name && !flags.category) {
			fmt.error("Provide at least one of --name or --category to update.");
			process.exit(1);
		}

		try {
			const result = await spinner({
				message: "Updating source...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					const requestBody: Record<string, unknown> = {};
					if (flags.name) {
						requestBody.display_name = flags.name;
					}
					if (flags.category) {
						requestBody.category_id = flags.category;
					}

					return await V2ApiSourcesService.updateSourceV2SourcesSourceIdPatch(
						args.id,
						requestBody as Parameters<
							typeof V2ApiSourcesService.updateSourceV2SourcesSourceIdPatch
						>[1],
						sourceType,
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Source" });
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

		const sourceType = validateSourceType(flags.type);

		try {
			const result = await spinner({
				message: "Deleting source...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiSourcesService.deleteSourceV2SourcesSourceIdDelete(
						args.id,
						sourceType,
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Source" });
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

		const sourceType = validateSourceType(flags.type);

		try {
			const result = await spinner({
				message: "Syncing source...",
				task: async () => {
					const sdk = await createSdk({ apiKey: global.apiKey });

					// Fetch the existing source to get its URL/identifier
					const source =
						await V2ApiSourcesService.getSourceV2SourcesSourceIdGet(
							args.id,
							sourceType,
						);

					const url = source.identifier;
					if (!url) {
						throw new Error(
							"Could not determine the source URL. The source may not have an identifier.",
						);
					}

					// Re-index by creating with the same URL
					return await sdk.sources.create({
						url,
						display_name: source.display_name,
					});
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Source" });
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

		try {
			const result = await spinner({
				message: "Renaming source...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiDataSourcesService.renameDataSourceV2V2DataSourcesRenamePatch(
						{
							identifier: args.identifier,
							new_name: args["new-name"],
						},
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Source" });
		}
	},
});

// --- Content subcommands ---

const readCommand = defineCommand({
	meta: {
		name: "read",
		description: "Read a file from an indexed source",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Source ID",
			required: true,
		},
		{
			name: "path",
			type: "string",
			description: "File path within the source",
			required: true,
		},
	] as const,
	flags: {
		"line-start": {
			type: "number",
			description: "Starting line number",
		},
		"line-end": {
			type: "number",
			description: "Ending line number",
		},
		"max-length": {
			type: "number",
			description: "Maximum content length to return",
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

		validateSourceType(flags.type);

		try {
			const result = await spinner({
				message: "Reading file...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiDataSourcesService.readDocumentationFileV2V2DataSourcesSourceIdReadGet(
						args.id,
						args.path,
						undefined, // page
						undefined, // treeNodeId
						flags["line-start"] ?? undefined,
						flags["line-end"] ?? undefined,
						flags["max-length"] ?? undefined,
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Source" });
		}
	},
});

const grepCommand = defineCommand({
	meta: {
		name: "grep",
		description: "Search for a pattern in source files",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Source ID",
			required: true,
		},
		{
			name: "pattern",
			type: "string",
			description: "Search pattern (regex)",
			required: true,
		},
	] as const,
	flags: {
		path: {
			type: "string",
			description: "Filter by file path prefix",
		},
		"case-sensitive": {
			type: "boolean",
			description: "Enable case-sensitive matching",
		},
		"whole-word": {
			type: "boolean",
			description: "Match whole words only",
		},
		"lines-before": {
			type: "number",
			description: "Number of context lines before each match",
		},
		"lines-after": {
			type: "number",
			description: "Number of context lines after each match",
		},
		"max-per-file": {
			type: "number",
			description: "Maximum matches per file",
		},
		"max-total": {
			type: "number",
			description: "Maximum total matches",
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

		validateSourceType(flags.type);

		try {
			const result = await spinner({
				message: "Searching source files...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					const requestBody: GrepRequest = {
						pattern: args.pattern,
					};

					if (flags.path) {
						requestBody.path = flags.path;
					}
					if (flags["case-sensitive"] !== undefined) {
						requestBody.case_sensitive = flags["case-sensitive"];
					}
					if (flags["whole-word"] !== undefined) {
						requestBody.whole_word = flags["whole-word"];
					}
					if (flags["lines-before"] !== undefined) {
						requestBody.B = flags["lines-before"];
					}
					if (flags["lines-after"] !== undefined) {
						requestBody.A = flags["lines-after"];
					}
					if (flags["max-per-file"] !== undefined) {
						requestBody.max_matches_per_file = flags["max-per-file"];
					}
					if (flags["max-total"] !== undefined) {
						requestBody.max_total_matches = flags["max-total"];
					}

					return await V2ApiDataSourcesService.grepDocumentationV2V2DataSourcesSourceIdGrepPost(
						args.id,
						requestBody,
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Source" });
		}
	},
});

const treeCommand = defineCommand({
	meta: {
		name: "tree",
		description: "View the file tree of an indexed source",
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

		validateSourceType(flags.type);

		try {
			const result = await spinner({
				message: "Fetching tree...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiDataSourcesService.getDocumentationTreeV2V2DataSourcesSourceIdTreeGet(
						args.id,
					);
				},
			});

			// If there's a tree_string, show it directly in text mode for readability
			if (global.output !== "json" && result.tree_string) {
				console.log(result.tree_string);
			} else {
				fmt.output(result);
			}
		} catch (error) {
			handleError(error, { domain: "Source" });
		}
	},
});

const lsCommand = defineCommand({
	meta: {
		name: "ls",
		description: "List files and directories in a source path",
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
		path: {
			type: "string",
			description: "Directory path within the source (default: root)",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		try {
			const result = await spinner({
				message: "Listing directory...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiDataSourcesService.listDocumentationDirectoryV2V2DataSourcesSourceIdLsGet(
						args.id,
						flags.path,
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Source" });
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
		read: readCommand,
		grep: grepCommand,
		tree: treeCommand,
		ls: lsCommand,
	},
});
