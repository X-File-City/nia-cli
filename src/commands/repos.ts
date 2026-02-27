import { defineCommand } from "@crustjs/core";
import type { RepositoryRequest } from "nia-ai-ts";
import { V2ApiRepositoriesService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";
import { createSpinner } from "../utils/spinner.ts";

/**
 * Shared error handler for repos commands.
 * Maps common SDK errors to user-friendly messages.
 */
function handleReposError(error: unknown): never {
	const status = (error as { status?: number }).status;
	const message = (error as Error).message ?? String(error);

	if (status === 401 || status === 403) {
		console.error("Authentication failed — run `nia auth login` to authenticate.");
	} else if (status === 404) {
		console.error("Repository not found. Check the repository ID and try again.");
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
			description: "Branch to index (defaults to the repository's default branch)",
		},
		ref: {
			type: "string",
			description: "Git ref to index (branch, tag, or commit SHA). Takes precedence over --branch",
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
		const spinner = createSpinner({ color: global.color });

		spinner.start("Indexing repository...");

		try {
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

			const result =
				await V2ApiRepositoriesService.indexRepositoryV2V2RepositoriesPost(requestBody);

			spinner.stop("Repository indexed");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Indexing failed");
			handleReposError(error);
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
		const spinner = createSpinner({ color: global.color });

		spinner.start("Listing repositories...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await V2ApiRepositoriesService.listRepositoriesV2V2RepositoriesGet(
				flags.query,
				flags.status,
				flags.limit,
				flags.offset,
			);

			spinner.stop("Repositories retrieved");
			fmt.output(result);
		} catch (error) {
			spinner.stop("List failed");
			handleReposError(error);
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
		const spinner = createSpinner({ color: global.color });

		spinner.start("Checking repository status...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result =
				await V2ApiRepositoriesService.getRepositoryStatusV2V2RepositoriesRepositoryIdGet(args.id);

			spinner.stop("Status retrieved");

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
			spinner.stop("Status check failed");
			handleReposError(error);
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
		const spinner = createSpinner({ color: global.color });

		spinner.start("Deleting repository...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result =
				await V2ApiRepositoriesService.deleteRepositoryV2V2RepositoriesRepositoryIdDelete(args.id);

			spinner.stop("Repository deleted");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Delete failed");
			handleReposError(error);
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
		const spinner = createSpinner({ color: global.color });

		spinner.start("Renaming repository...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result =
				await V2ApiRepositoriesService.renameRepositoryV2V2RepositoriesRepositoryIdRenamePatch(
					args.id,
					{ new_name: args["new-name"] },
				);

			spinner.stop("Repository renamed");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Rename failed");
			handleReposError(error);
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
	},
});
