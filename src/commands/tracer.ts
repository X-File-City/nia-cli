import { defineCommand } from "@crustjs/core";
import type { TracerRequest } from "nia-ai-ts";
import { GithubSearchService, OpenAPI } from "nia-ai-ts";
import { resolveBaseUrl } from "../services/config.ts";
import { createSdk } from "../services/sdk.ts";
import { handleError } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";
import { createSpinner } from "../utils/spinner.ts";
import { renderStreamEvent } from "../utils/streaming.ts";

// --- Subcommands ---

const runCommand = defineCommand({
	meta: {
		name: "run",
		description: "Create a new Tracer code search job",
	},
	args: [
		{
			name: "query",
			type: "string",
			description: "Research question to search for in GitHub repositories",
			required: true,
		},
	] as const,
	flags: {
		repos: {
			type: "string",
			description: "Repositories to search in owner/repo format (comma-separated)",
		},
		context: {
			type: "string",
			description: "Additional context for the search query",
		},
		model: {
			type: "string",
			description: "Model override (claude-opus-4-6 or claude-opus-4-6-1m)",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Creating Tracer search job...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const payload: TracerRequest = {
				query: args.query,
			};

			if (flags.repos) {
				payload.repositories = flags.repos.split(",").map((s) => s.trim());
			}
			if (flags.context) {
				payload.context = flags.context;
			}
			if (flags.model) {
				payload.model = flags.model;
			}

			const result = await GithubSearchService.createTracerJobV2GithubTracerPost(payload);

			spinner.stop("Tracer job created");
			fmt.output(result);

			// Print hint for streaming in text/table mode
			if (global.output !== "json") {
				const jobId = (result as Record<string, unknown>)?.job_id;
				if (jobId) {
					console.log(`\nUse \`nia tracer stream ${jobId}\` to watch progress`);
				}
			}
		} catch (error) {
			spinner.stop("Failed to create Tracer job");
			handleError(error, { domain: "Tracer" });
		}
	},
});

const statusCommand = defineCommand({
	meta: {
		name: "status",
		description: "Get the status and result of a Tracer search job",
	},
	args: [
		{
			name: "job-id",
			type: "string",
			description: "Tracer job ID",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Fetching Tracer job status...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await GithubSearchService.getTracerJobV2GithubTracerJobIdGet(args["job-id"]);

			spinner.stop("Job status retrieved");

			// In text mode, show a formatted summary
			if (global.output !== "json") {
				const job = result as Record<string, unknown>;
				console.log(`Job ID:     ${job.job_id ?? args["job-id"]}`);
				console.log(`Status:     ${job.status ?? "unknown"}`);
				if (job.query) {
					console.log(`Query:      ${job.query}`);
				}
				if (job.session_id) {
					console.log(`Session ID: ${job.session_id}`);
				}
				if (job.created_at) {
					console.log(`Created:    ${job.created_at}`);
				}
				if (job.completed_at) {
					console.log(`Completed:  ${job.completed_at}`);
				}
				if (job.result) {
					console.log("\n--- Result ---");
					fmt.output(job.result);
				}
				if (job.error) {
					console.log(`\nError: ${job.error}`);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to fetch Tracer job status");
			handleError(error, { domain: "Tracer" });
		}
	},
});

const streamCommand = defineCommand({
	meta: {
		name: "stream",
		description: "Stream real-time updates from a Tracer search job",
	},
	args: [
		{
			name: "job-id",
			type: "string",
			description: "Tracer job ID to stream",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const spinner = createSpinner({ color: global.color });

		spinner.start("Connecting to Tracer job stream...");

		try {
			await createSdk({ apiKey: global.apiKey });

			// GithubSearchService.streamTracerJobV2GithubTracerJobIdStreamGet()
			// returns CancelablePromise<any>, not an AsyncGenerator.
			// Use manual SSE fetch + reader pattern (same as oracle chat).
			const baseUrl = await resolveBaseUrl();
			const token = OpenAPI.TOKEN;

			const response = await fetch(
				`${baseUrl}/github/tracer/${encodeURIComponent(args["job-id"])}/stream`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: "text/event-stream",
					},
				},
			);

			if (!response.ok || !response.body) {
				const err = new Error(`Stream request failed with status ${response.status}`);
				(err as Error & { status: number }).status = response.status;
				throw err;
			}

			spinner.stop("Streaming Tracer job events");

			// Parse SSE stream manually
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";

				for (const line of lines) {
					if (!line.startsWith("data: ")) continue;
					const payload = line.slice(6).trim();
					if (!payload) continue;

					try {
						const event = JSON.parse(payload) as Record<string, unknown>;
						renderStreamEvent(event, { color: global.color });
					} catch {}
				}
			}

			// Print newline after stream completes for clean terminal state
			if (process.stdout.isTTY) {
				console.log();
			}
		} catch (error) {
			spinner.stop("Failed to stream Tracer job");
			handleError(error, { domain: "Tracer" });
		}
	},
});

const listCommand = defineCommand({
	meta: {
		name: "list",
		description: "List Tracer search jobs",
	},
	args: [],
	flags: {
		status: {
			type: "string",
			description: "Filter by status: queued, running, completed, failed, cancelled",
		},
		limit: {
			type: "number",
			description: "Maximum number of jobs to return",
		},
		skip: {
			type: "number",
			description: "Number of jobs to skip (for pagination)",
		},
	},
	async run({ flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		// Validate status if provided
		const validStatuses = ["queued", "running", "completed", "failed", "cancelled"];
		if (flags.status && !validStatuses.includes(flags.status)) {
			fmt.error(`Invalid status: "${flags.status}". Allowed: ${validStatuses.join(", ")}`);
			process.exit(1);
		}

		spinner.start("Fetching Tracer jobs...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await GithubSearchService.listTracerJobsV2GithubTracerGet(
				flags.status ?? undefined,
				flags.limit ?? undefined,
				flags.skip ?? undefined,
			);

			spinner.stop("Jobs retrieved");

			// In text/table mode, format as a table
			if (global.output !== "json" && Array.isArray(result)) {
				if (result.length === 0) {
					console.log("No Tracer jobs found.");
				} else {
					const rows = result.map((job: Record<string, unknown>) => ({
						job_id: String(job.job_id ?? ""),
						status: String(job.status ?? ""),
						query:
							String(job.query ?? "").length > 60
								? `${String(job.query ?? "").slice(0, 57)}...`
								: String(job.query ?? ""),
						created_at: String(job.created_at ?? ""),
					}));
					fmt.output(rows);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to fetch Tracer jobs");
			handleError(error, { domain: "Tracer" });
		}
	},
});

const deleteCommand = defineCommand({
	meta: {
		name: "delete",
		description: "Delete a Tracer search job",
	},
	args: [
		{
			name: "job-id",
			type: "string",
			description: "Tracer job ID to delete",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Deleting Tracer job...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await GithubSearchService.deleteTracerJobV2GithubTracerJobIdDelete(
				args["job-id"],
			);

			spinner.stop("Tracer job deleted");

			if (global.output === "json") {
				fmt.output(result);
			} else {
				console.log(`Tracer job ${args["job-id"]} has been deleted.`);
			}
		} catch (error) {
			spinner.stop("Failed to delete Tracer job");
			handleError(error, { domain: "Tracer" });
		}
	},
});

export const tracerCommand = defineCommand({
	meta: {
		name: "tracer",
		description: "Autonomous GitHub code search without indexing",
	},
	subCommands: {
		run: runCommand,
		status: statusCommand,
		stream: streamCommand,
		list: listCommand,
		delete: deleteCommand,
	},
});
