import { spinner } from "@crustjs/prompts";
import type { HuggingFaceDatasetRequest } from "nia-ai-ts";
import { V2ApiDataSourcesService } from "nia-ai-ts";
import { app } from "../app.ts";
import { createSdk } from "../services/sdk.ts";
import { handleError } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";

// --- Subcommands ---

const indexCommand = app
	.sub("index")
	.meta({ description: "Index a HuggingFace dataset" })
	.args([
		{
			name: "dataset",
			type: "string",
			description:
				"HuggingFace dataset URL or identifier (e.g., dair-ai/emotion, https://huggingface.co/datasets/squad)",
			required: true,
		},
	] as const)
	.flags({
		config: {
			type: "string",
			description: "Dataset configuration name (for multi-config datasets)",
		},
		global: {
			type: "boolean",
			description: "Add to global shared pool (default: true)",
			default: true,
		},
	})
	.run(async ({ args, flags }) => {
		try {
			const result = await spinner({
				message: "Indexing HuggingFace dataset...",
				task: async () => {
					await createSdk({ apiKey: flags["api-key"] });

					const payload: HuggingFaceDatasetRequest = {
						url: args.dataset,
					};

					if (flags.config) {
						payload.config = flags.config;
					}

					if (flags.global === false) {
						payload.add_as_global_source = false;
					}

					return await V2ApiDataSourcesService.indexHuggingfaceDatasetV2V2HuggingfaceDatasetsPost(
						payload,
					);
				},
			});

			const data = result as Record<string, unknown>;
			console.log("Dataset indexed successfully.");
			if (data.source_id) {
				console.log(`  Source ID: ${data.source_id}`);
			}
			if (data.name) {
				console.log(`  Name: ${data.name}`);
			}
			if (data.status) {
				console.log(`  Status: ${data.status}`);
			}
			if (data.message) {
				console.log(`  ${data.message}`);
			}
		} catch (error) {
			handleError(error, { domain: "Dataset" });
		}
	});

const listCommand = app
	.sub("list")
	.meta({ description: "List indexed HuggingFace datasets" })
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

		try {
			const result = await spinner({
				message: "Loading HuggingFace datasets...",
				task: async () => {
					await createSdk({ apiKey: flags["api-key"] });

					return await V2ApiDataSourcesService.listHuggingfaceDatasetsV2V2HuggingfaceDatasetsGet(
						flags.status ?? undefined,
						flags.limit ?? undefined,
						flags.offset ?? undefined,
					);
				},
			});

			const data = result as Record<string, unknown>;
			const datasets = (data.datasets ?? data.items ?? []) as Array<
				Record<string, unknown>
			>;

			if (datasets.length === 0) {
				console.log("No HuggingFace datasets found.");
			} else {
				const rows = datasets.map((d) => ({
					name: d.display_name ?? d.name ?? d.title ?? "Untitled",
					id: d.source_id ?? d.id ?? "",
					status: d.status ?? "",
					created: d.created_at ?? "",
				}));
				console.log(fmt.formatTable(rows, ["name", "id", "status", "created"]));

				if (data.total !== undefined) {
					console.log(`\nTotal: ${data.total} datasets`);
				}
			}
		} catch (error) {
			handleError(error, { domain: "Dataset" });
		}
	});

export const datasetsCommand = app
	.sub("datasets")
	.meta({ description: "Index and list HuggingFace datasets" })
	.command(indexCommand)
	.command(listCommand);
