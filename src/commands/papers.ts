import { annotate } from "@crustjs/skills";
import type { routes__v2__data_sources__ResearchPaperRequest } from "nia-ai-ts";
import { V2ApiDataSourcesService } from "nia-ai-ts";
import { app } from "../app.ts";
import { createSdk } from "../services/sdk.ts";
import { withErrorHandling } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";

// --- Subcommands ---

const indexCommand = annotate(
	app
		.sub("index")
		.meta({ description: "Index an arXiv research paper" })
		.args([
			{
				name: "paper",
				type: "string",
				description:
					"arXiv ID or URL (e.g., 2312.00752, https://arxiv.org/abs/2312.00752, hep-th/9901001)",
				required: true,
			},
		] as const)
		.flags({
			name: {
				type: "string",
				description: "Display name for the paper",
			},
			global: {
				type: "boolean",
				description: "Add to global shared pool (default: true)",
				default: true,
			},
		})
		.run(async ({ args, flags }) => {
			await withErrorHandling({ domain: "Paper" }, async () => {
				await createSdk({ apiKey: flags["api-key"] });

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

				const data = result as Record<string, unknown>;
				console.log("Paper indexed successfully.");
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
			});
		}),
	[
		"Supports various arXiv formats: `2312.00752`, `https://arxiv.org/abs/2312.00752`, PDF URLs, old format (`hep-th/9901001`), with version (`2312.00752v1`).",
		"Indexing takes 1-5 minutes. Check status with `nia sources list --type research_paper`.",
	],
);

const listCommand = app
	.sub("list")
	.meta({ description: "List indexed research papers" })
	.flags({
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
	})
	.run(async ({ flags }) => {
		const fmt = createFormatter({ color: flags.color });

		await withErrorHandling({ domain: "Paper" }, async () => {
			await createSdk({ apiKey: flags["api-key"] });

			const result =
				await V2ApiDataSourcesService.listResearchPapersV2V2ResearchPapersGet(
					flags.status ?? undefined,
					flags.limit ?? undefined,
					flags.offset ?? undefined,
				);

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
		});
	});

export const papersCommand = annotate(
	app
		.sub("papers")
		.meta({ description: "Index and list arXiv research papers" })
		.command(indexCommand)
		.command(listCommand),
	[
		"Index arXiv research papers for searchable access via Nia.",
		"After indexing, search paper content with `nia search query` or `nia sources read`.",
	],
);
