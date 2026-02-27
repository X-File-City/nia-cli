import { defineCommand } from "@crustjs/core";
import { DefaultService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";
import { createSpinner } from "../utils/spinner.ts";

/**
 * Shared error handler for oracle commands.
 * Maps common SDK errors to user-friendly messages.
 */
function handleOracleError(error: unknown): never {
	const status = (error as { status?: number }).status;
	const message = (error as Error).message ?? String(error);

	if (status === 401 || status === 403) {
		console.error("Authentication failed — run `nia auth login` to authenticate.");
	} else if (status === 404) {
		console.error("Oracle job not found. Check the job ID and try again.");
	} else if (status === 422) {
		console.error(`Validation error: ${message}`);
	} else if (status === 429) {
		console.error(
			"Rate limited — you may have too many concurrent jobs. Max 3 concurrent jobs allowed.",
		);
	} else if (status && status >= 500) {
		console.error(`Server error (${status}) — try again later.`);
	} else {
		console.error(`Oracle operation failed: ${message}`);
	}

	process.exit(1);
}

// --- Subcommands ---

const jobCommand = defineCommand({
	meta: {
		name: "job",
		description: "Create a new Oracle research job",
	},
	args: [
		{
			name: "query",
			type: "string",
			description: "Research question to investigate",
			required: true,
		},
	] as const,
	flags: {
		repos: {
			type: "string",
			description: "Repository names to search (comma-separated)",
		},
		docs: {
			type: "string",
			description: "Documentation source names to search (comma-separated)",
		},
		"output-format": {
			type: "string",
			description: "Optional structure hint for the output",
		},
		model: {
			type: "string",
			description: "Model to use (e.g., claude-opus-4-6, claude-sonnet-4-5-20250929)",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Creating Oracle research job...");

		try {
			const sdk = await createSdk({ apiKey: global.apiKey });

			const payload: Record<string, unknown> = {
				query: args.query,
			};

			if (flags.repos) {
				payload.repositories = flags.repos.split(",").map((s) => s.trim());
			}
			if (flags.docs) {
				payload.data_sources = flags.docs.split(",").map((s) => s.trim());
			}
			if (flags["output-format"]) {
				payload.output_format = flags["output-format"];
			}
			if (flags.model) {
				payload.model = flags.model;
			}

			const result = await sdk.oracle.createJob(payload);

			spinner.stop("Oracle job created");
			fmt.output(result);

			// Print hint for streaming in text/table mode
			if (global.output !== "json") {
				const jobId = (result as Record<string, unknown>)?.job_id;
				if (jobId) {
					console.log(`\nUse \`nia oracle stream ${jobId}\` to watch progress`);
				}
			}
		} catch (error) {
			spinner.stop("Failed to create Oracle job");
			handleOracleError(error);
		}
	},
});

const statusCommand = defineCommand({
	meta: {
		name: "status",
		description: "Get the status and details of an Oracle research job",
	},
	args: [
		{
			name: "job-id",
			type: "string",
			description: "Oracle job ID",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Fetching job status...");

		try {
			const sdk = await createSdk({ apiKey: global.apiKey });

			const result = await sdk.oracle.getJob(args["job-id"]);

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
			spinner.stop("Failed to fetch job status");
			handleOracleError(error);
		}
	},
});

const cancelCommand = defineCommand({
	meta: {
		name: "cancel",
		description: "Cancel a running or queued Oracle research job",
	},
	args: [
		{
			name: "job-id",
			type: "string",
			description: "Oracle job ID to cancel",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Cancelling Oracle job...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await DefaultService.cancelOracleJobV2OracleJobsJobIdDelete(args["job-id"]);

			spinner.stop("Oracle job cancelled");

			if (global.output === "json") {
				fmt.output(result);
			} else {
				console.log(`Job ${args["job-id"]} has been cancelled.`);
			}
		} catch (error) {
			spinner.stop("Failed to cancel Oracle job");
			handleOracleError(error);
		}
	},
});

const jobsCommand = defineCommand({
	meta: {
		name: "jobs",
		description: "List Oracle research jobs",
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

		spinner.start("Fetching Oracle jobs...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await DefaultService.listOracleJobsV2OracleJobsGet(
				flags.status ?? undefined,
				flags.limit ?? undefined,
				flags.skip ?? undefined,
			);

			spinner.stop("Jobs retrieved");

			// In text/table mode, format as a table
			if (global.output !== "json" && Array.isArray(result)) {
				if (result.length === 0) {
					console.log("No Oracle jobs found.");
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
			spinner.stop("Failed to fetch Oracle jobs");
			handleOracleError(error);
		}
	},
});

export const oracleCommand = defineCommand({
	meta: {
		name: "oracle",
		description: "Run autonomous AI research jobs",
	},
	subCommands: {
		job: jobCommand,
		status: statusCommand,
		cancel: cancelCommand,
		jobs: jobsCommand,
	},
});
