import { defineCommand } from "@crustjs/core";
import { spinner } from "@crustjs/prompts";
import type { HuggingFaceDatasetRequest } from "nia-ai-ts";
import { V2ApiDataSourcesService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { handleError } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";

// --- Subcommands ---

const indexCommand = defineCommand({
	meta: {
		name: "index",
		description: "Index a HuggingFace dataset",
	},
	args: [
		{
			name: "dataset",
			type: "string",
			description:
				"HuggingFace dataset URL or identifier (e.g., dair-ai/emotion, https://huggingface.co/datasets/squad)",
			required: true,
		},
	] as const,
	flags: {
		config: {
			type: "string",
			description: "Dataset configuration name (for multi-config datasets)",
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

		try {
			const result = await spinner({
				message: "Indexing HuggingFace dataset...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

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

			// In text mode, show summary
			if (global.output !== "json") {
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
			} else {
				fmt.output(result);
			}
		} catch (error) {
			handleError(error, { domain: "Dataset" });
		}
	},
});

const listCommand = defineCommand({
	meta: {
		name: "list",
		description: "List indexed HuggingFace datasets",
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

		try {
			const result = await spinner({
				message: "Loading HuggingFace datasets...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiDataSourcesService.listHuggingfaceDatasetsV2V2HuggingfaceDatasetsGet(
						flags.status ?? undefined,
						flags.limit ?? undefined,
						flags.offset ?? undefined,
					);
				},
			});

			// In text mode, show as table
			if (global.output !== "json") {
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
					console.log(
						fmt.formatTable(rows, ["name", "id", "status", "created"]),
					);

					if (data.total !== undefined) {
						console.log(`\nTotal: ${data.total} datasets`);
					}
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			handleError(error, { domain: "Dataset" });
		}
	},
});

export const datasetsCommand = defineCommand({
	meta: {
		name: "datasets",
		description: "Index and list HuggingFace datasets",
	},
	subCommands: {
		index: indexCommand,
		list: listCommand,
	},
});
