import { defineCommand } from "@crustjs/core";
import type { routes__v2__data_sources__ResearchPaperRequest } from "nia-ai-ts";
import { V2ApiDataSourcesService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { handleError } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";
import { createSpinner } from "../utils/spinner.ts";

// --- Subcommands ---

const indexCommand = defineCommand({
	meta: {
		name: "index",
		description: "Index an arXiv research paper",
	},
	args: [
		{
			name: "paper",
			type: "string",
			description:
				"arXiv ID or URL (e.g., 2312.00752, https://arxiv.org/abs/2312.00752, hep-th/9901001)",
			required: true,
		},
	] as const,
	flags: {
		name: {
			type: "string",
			description: "Display name for the paper",
		},
		global: {
			type: "boolean",
			description: "Add to global shared pool (default: true)",
			default: true,
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Indexing research paper...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const payload: routes__v2__data_sources__ResearchPaperRequest = {
				url: args.paper,
			};

			if (flags.global === false) {
				payload.add_as_global_source = false;
			}

			const result =
				await V2ApiDataSourcesService.indexResearchPaperV2V2ResearchPapersPost(
					payload,
				);

			spinner.stop("Paper indexed");

			// In text mode, show summary
			if (global.output !== "json") {
				const data = result as Record<string, unknown>;
				console.log(`Paper indexed successfully.`);
				if (data.source_id) {
					console.log(`  Source ID: ${data.source_id}`);
				}
				if (data.title) {
					console.log(`  Title: ${data.title}`);
				}
				if (data.status) {
					console.log(`  Status: ${data.status}`);
				}
				if (data.message) {
					console.log(`  ${data.message}`);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Indexing failed");
			handleError(error, { domain: "Paper" });
		}
	},
});

const listCommand = defineCommand({
	meta: {
		name: "list",
		description: "List indexed research papers",
	},
	args: [] as const,
	flags: {
		status: {
			type: "string",
			description: "Filter by status: processing, completed, failed",
		},
		limit: {
			type: "number",
			description: "Maximum number of results",
		},
		offset: {
			type: "number",
			description: "Pagination offset",
		},
	},
	async run({ flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Loading research papers...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result =
				await V2ApiDataSourcesService.listResearchPapersV2V2ResearchPapersGet(
					flags.status ?? undefined,
					flags.limit ?? undefined,
					flags.offset ?? undefined,
				);

			spinner.stop("Papers loaded");

			// In text mode, show as table
			if (global.output !== "json") {
				const data = result as Record<string, unknown>;
				const papers = (data.papers ?? data.items ?? []) as Array<
					Record<string, unknown>
				>;

				if (papers.length === 0) {
					console.log("No research papers found.");
				} else {
					const rows = papers.map((p) => ({
						title: p.title ?? p.name ?? "Untitled",
						id: p.source_id ?? p.id ?? "",
						status: p.status ?? "",
						created: p.created_at ?? "",
					}));
					console.log(
						fmt.formatTable(rows, ["title", "id", "status", "created"]),
					);

					if (data.total !== undefined) {
						console.log(`\nTotal: ${data.total} papers`);
					}
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to load papers");
			handleError(error, { domain: "Paper" });
		}
	},
});

export const papersCommand = defineCommand({
	meta: {
		name: "papers",
		description: "Index and list arXiv research papers",
	},
	subCommands: {
		index: indexCommand,
		list: listCommand,
	},
});
