import { defineCommand } from "@crustjs/core";
import { spinner } from "@crustjs/prompts";
import type { CodeGrepRequest, RepositoryRequest } from "nia-ai-ts";
import { V2ApiRepositoriesService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { handleError } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";

// --- Subcommands ---

const indexCommand = defineCommand({
	meta: {
		name: "index",
		description: "Index a GitHub repository",
	},
	args: [
		{
			name: "repo",
			type: "string",
			description: "Repository in owner/repo format (e.g., vercel/ai)",
			required: true,
		},
	] as const,
	flags: {
		branch: {
			type: "string",
			alias: "b",
			description:
				"Branch to index (defaults to the repository's default branch)",
		},
		ref: {
			type: "string",
			description:
				"Git ref to index (branch, tag, or commit SHA). Takes precedence over --branch",
		},
		name: {
			type: "string",
			description: "Custom display name for the repository",
		},
		private: {
			type: "boolean",
			description: "Index privately (don't add to global pool)",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		try {
			const result = await spinner({
				message: "Indexing repository...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					const requestBody: RepositoryRequest = {
						repository: args.repo,
					};

					if (flags.branch) {
						requestBody.branch = flags.branch;
					}
					if (flags.ref) {
						requestBody.ref = flags.ref;
					}
					if (flags.private !== undefined) {
						requestBody.add_as_global_source = !flags.private;
					}

					return await V2ApiRepositoriesService.indexRepositoryV2V2RepositoriesPost(
						requestBody,
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Repository" });
		}
	},
});

const listCommand = defineCommand({
	meta: {
		name: "list",
		description: "List indexed repositories",
	},
	flags: {
		query: {
			type: "string",
			description: "Filter by repository name (substring match)",
		},
		status: {
			type: "string",
			description: "Filter by indexing status",
		},
		limit: {
			type: "number",
			description: "Maximum number of results",
		},
		offset: {
			type: "number",
			description: "Offset for pagination",
		},
	},
	async run({ flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		try {
			const result = await spinner({
				message: "Listing repositories...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiRepositoriesService.listRepositoriesV2V2RepositoriesGet(
						flags.query,
						flags.status,
						flags.limit,
						flags.offset,
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Repository" });
		}
	},
});

const statusCommand = defineCommand({
	meta: {
		name: "status",
		description: "Check the indexing status of a repository",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Repository ID",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		try {
			const result = await spinner({
				message: "Checking repository status...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiRepositoriesService.getRepositoryStatusV2V2RepositoriesRepositoryIdGet(
						args.id,
					);
				},
			});

			// In text mode, show progress info if available
			if (global.output !== "json" && result.progress) {
				const progress = result.progress as Record<string, unknown>;
				const percentage = progress.percentage;
				const stage = progress.stage;
				const progressMsg = progress.message;

				console.log(`Repository: ${result.repository}`);
				console.log(`Branch:     ${result.branch}`);
				console.log(`Status:     ${result.status}`);
				if (percentage !== undefined) {
					console.log(`Progress:   ${percentage}%`);
				}
				if (stage) {
					console.log(`Stage:      ${stage}`);
				}
				if (progressMsg) {
					console.log(`Message:    ${progressMsg}`);
				}
				if (result.error) {
					console.log(`Error:      ${result.error}`);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			handleError(error, { domain: "Repository" });
		}
	},
});

const deleteCommand = defineCommand({
	meta: {
		name: "delete",
		description: "Delete an indexed repository",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Repository ID",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		try {
			const result = await spinner({
				message: "Deleting repository...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiRepositoriesService.deleteRepositoryV2V2RepositoriesRepositoryIdDelete(
						args.id,
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Repository" });
		}
	},
});

const renameCommand = defineCommand({
	meta: {
		name: "rename",
		description: "Rename an indexed repository",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Repository ID",
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
				message: "Renaming repository...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiRepositoriesService.renameRepositoryV2V2RepositoriesRepositoryIdRenamePatch(
						args.id,
						{ new_name: args["new-name"] },
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Repository" });
		}
	},
});

// --- Content subcommands ---

const readCommand = defineCommand({
	meta: {
		name: "read",
		description: "Read file content from an indexed repository",
	},
	args: [
		{
			name: "repo-id",
			type: "string",
			description: "Repository ID",
			required: true,
		},
		{
			name: "path",
			type: "string",
			description: "File path within the repository",
			required: true,
		},
	] as const,
	flags: {
		branch: {
			type: "string",
			alias: "b",
			description: "Branch name (defaults to the repository's default branch)",
		},
		ref: {
			type: "string",
			description:
				"Git ref (branch, tag, or commit SHA). Takes precedence over --branch",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		try {
			const result = await spinner({
				message: "Reading file...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiRepositoriesService.getRepositoryContentV2V2RepositoriesRepositoryIdContentGet(
						args["repo-id"],
						args.path,
						flags.branch ?? undefined,
						flags.ref ?? undefined,
					);
				},
			});

			// In text mode, show file content with line numbers for readability
			if (global.output !== "json" && result.success && result.content) {
				const lines = result.content.split("\n");
				const padding = String(lines.length).length;
				for (let i = 0; i < lines.length; i++) {
					const lineNum = String(i + 1).padStart(padding, " ");
					console.log(`${lineNum} | ${lines[i]}`);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			handleError(error, { domain: "Repository" });
		}
	},
});

const grepCommand = defineCommand({
	meta: {
		name: "grep",
		description: "Search for a pattern in repository files",
	},
	args: [
		{
			name: "repo-id",
			type: "string",
			description: "Repository ID",
			required: true,
		},
		{
			name: "pattern",
			type: "string",
			description: "Search pattern (regex or fixed string)",
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
		"fixed-string": {
			type: "boolean",
			description: "Treat pattern as a literal string instead of regex",
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
		exhaustive: {
			type: "boolean",
			description: "Search all chunks for complete results (default: true)",
		},
		ref: {
			type: "string",
			description: "Git ref (branch, tag, or commit SHA)",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		try {
			const result = await spinner({
				message: "Searching repository files...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					const requestBody: CodeGrepRequest = {
						pattern: args.pattern,
					};

					if (flags.path) {
						requestBody.path = flags.path;
					}
					if (flags.ref) {
						requestBody.ref = flags.ref;
					}
					if (flags["case-sensitive"] !== undefined) {
						requestBody.case_sensitive = flags["case-sensitive"];
					}
					if (flags["whole-word"] !== undefined) {
						requestBody.whole_word = flags["whole-word"];
					}
					if (flags["fixed-string"] !== undefined) {
						requestBody.fixed_string = flags["fixed-string"];
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
					if (flags.exhaustive !== undefined) {
						requestBody.exhaustive = flags.exhaustive;
					}

					return await V2ApiRepositoriesService.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost(
						args["repo-id"],
						requestBody,
					);
				},
			});

			fmt.output(result);
		} catch (error) {
			handleError(error, { domain: "Repository" });
		}
	},
});

const treeCommand = defineCommand({
	meta: {
		name: "tree",
		description: "View the file tree of an indexed repository",
	},
	args: [
		{
			name: "repo-id",
			type: "string",
			description: "Repository ID",
			required: true,
		},
	] as const,
	flags: {
		branch: {
			type: "string",
			alias: "b",
			description: "Branch name",
		},
		"include-paths": {
			type: "string",
			description: "Comma-separated path prefixes to include",
		},
		"exclude-paths": {
			type: "string",
			description: "Comma-separated path prefixes to exclude",
		},
		extensions: {
			type: "string",
			description: "Comma-separated file extensions to include (e.g., ts,js)",
		},
		"exclude-extensions": {
			type: "string",
			description: "Comma-separated file extensions to exclude",
		},
		"full-paths": {
			type: "boolean",
			description: "Show full file paths instead of tree structure",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		try {
			const result = await spinner({
				message: "Fetching tree...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiRepositoriesService.getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet(
						args["repo-id"],
						flags.branch ?? undefined,
						flags["include-paths"] ?? undefined,
						flags["exclude-paths"] ?? undefined,
						flags.extensions ?? undefined,
						flags["exclude-extensions"] ?? undefined,
						flags["full-paths"] ?? undefined,
					);
				},
			});

			// If there's a tree_text, show it directly in text mode for readability
			if (global.output !== "json" && result.tree_text) {
				console.log(result.tree_text);

				// Show stats summary if available
				if (result.stats) {
					const stats = result.stats as Record<string, unknown>;
					const parts: string[] = [];
					if (stats.total_files !== undefined) {
						parts.push(`${stats.total_files} files`);
					}
					if (stats.total_directories !== undefined) {
						parts.push(`${stats.total_directories} directories`);
					}
					if (parts.length > 0) {
						console.log(`\n${parts.join(", ")}`);
					}
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			handleError(error, { domain: "Repository" });
		}
	},
});

// --- Parent command ---

export const reposCommand = defineCommand({
	meta: {
		name: "repos",
		description: "Manage indexed repositories",
	},
	subCommands: {
		index: indexCommand,
		list: listCommand,
		status: statusCommand,
		delete: deleteCommand,
		rename: renameCommand,
		read: readCommand,
		grep: grepCommand,
		tree: treeCommand,
	},
});
