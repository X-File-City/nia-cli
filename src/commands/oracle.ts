import { defineCommand } from "@crustjs/core";
import type { OracleSessionChatRequest } from "nia-ai-ts";
import { DefaultService, OpenAPI } from "nia-ai-ts";
import { resolveBaseUrl } from "../services/config.ts";
import { createSdk } from "../services/sdk.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";
import { createSpinner } from "../utils/spinner.ts";
import { renderStream, renderStreamEvent } from "../utils/streaming.ts";

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

// --- Streaming & Session Subcommands ---

const streamCommand = defineCommand({
	meta: {
		name: "stream",
		description: "Stream real-time updates from an Oracle research job",
	},
	args: [
		{
			name: "job-id",
			type: "string",
			description: "Oracle job ID to stream",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const spinner = createSpinner({ color: global.color });

		spinner.start("Connecting to Oracle job stream...");

		try {
			const sdk = await createSdk({ apiKey: global.apiKey });

			const stream = sdk.oracle.streamJob(args["job-id"]);

			spinner.stop("Streaming Oracle job events");

			await renderStream(stream, { color: global.color });

			// Print newline after stream completes for clean terminal state
			if (process.stdout.isTTY) {
				console.log();
			}
		} catch (error) {
			spinner.stop("Failed to stream Oracle job");
			handleOracleError(error);
		}
	},
});

const sessionsCommand = defineCommand({
	meta: {
		name: "sessions",
		description: "List Oracle research sessions",
	},
	args: [],
	flags: {
		limit: {
			type: "number",
			description: "Maximum number of sessions to return",
		},
		skip: {
			type: "number",
			description: "Number of sessions to skip (for pagination)",
		},
	},
	async run({ flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Fetching Oracle sessions...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await DefaultService.listOracleSessionsV2OracleSessionsGet(
				flags.limit ?? undefined,
				flags.skip ?? undefined,
			);

			spinner.stop("Sessions retrieved");

			if (global.output !== "json" && Array.isArray(result)) {
				if (result.length === 0) {
					console.log("No Oracle sessions found.");
				} else {
					const rows = result.map((session: Record<string, unknown>) => ({
						session_id: String(session.session_id ?? ""),
						query:
							String(session.query ?? "").length > 60
								? `${String(session.query ?? "").slice(0, 57)}...`
								: String(session.query ?? ""),
						status: String(session.status ?? ""),
						created_at: String(session.created_at ?? ""),
					}));
					fmt.output(rows);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to fetch Oracle sessions");
			handleOracleError(error);
		}
	},
});

const sessionCommand = defineCommand({
	meta: {
		name: "session",
		description: "Get full details of an Oracle research session",
	},
	args: [
		{
			name: "session-id",
			type: "string",
			description: "Oracle session ID",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Fetching session details...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await DefaultService.getOracleSessionDetailV2OracleSessionsSessionIdGet(
				args["session-id"],
			);

			spinner.stop("Session details retrieved");

			if (global.output !== "json") {
				const session = result as Record<string, unknown>;
				console.log(`Session ID: ${session.session_id ?? args["session-id"]}`);
				if (session.query) {
					console.log(`Query:      ${session.query}`);
				}
				if (session.status) {
					console.log(`Status:     ${session.status}`);
				}
				if (session.model) {
					console.log(`Model:      ${session.model}`);
				}
				if (session.created_at) {
					console.log(`Created:    ${session.created_at}`);
				}
				if (session.completed_at) {
					console.log(`Completed:  ${session.completed_at}`);
				}
				if (session.result) {
					console.log("\n--- Result ---");
					fmt.output(session.result);
				}
				if (session.job_id) {
					console.log(`\nJob ID: ${session.job_id}`);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to fetch session details");
			handleOracleError(error);
		}
	},
});

const messagesCommand = defineCommand({
	meta: {
		name: "messages",
		description: "Get chat messages for an Oracle research session",
	},
	args: [
		{
			name: "session-id",
			type: "string",
			description: "Oracle session ID",
			required: true,
		},
	] as const,
	flags: {
		limit: {
			type: "number",
			description: "Maximum number of messages to return",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Fetching session messages...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result =
				await DefaultService.getOracleSessionMessagesV2OracleSessionsSessionIdMessagesGet(
					args["session-id"],
					flags.limit ?? undefined,
				);

			spinner.stop("Messages retrieved");

			if (global.output !== "json" && Array.isArray(result)) {
				if (result.length === 0) {
					console.log("No messages found for this session.");
				} else {
					for (const msg of result) {
						const message = msg as Record<string, unknown>;
						const role = String(message.role ?? "unknown");
						const content = String(message.content ?? "");
						const timestamp = message.created_at ? ` (${String(message.created_at)})` : "";

						console.log(`[${role}]${timestamp}`);
						console.log(content);
						console.log();
					}
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to fetch session messages");
			handleOracleError(error);
		}
	},
});

const chatCommand = defineCommand({
	meta: {
		name: "chat",
		description: "Send a follow-up message to an Oracle research session",
	},
	args: [
		{
			name: "session-id",
			type: "string",
			description: "Oracle session ID",
			required: true,
		},
		{
			name: "message",
			type: "string",
			description: "Follow-up question or message",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const spinner = createSpinner({ color: global.color });

		spinner.start("Connecting to session chat...");

		try {
			await createSdk({ apiKey: global.apiKey });

			// The DefaultService chat endpoint returns a CancelablePromise,
			// but the actual response is an SSE stream. Use manual fetch
			// with SSE parsing similar to sdk.oracle.streamJob().
			const baseUrl = await resolveBaseUrl();
			const token = OpenAPI.TOKEN;

			const response = await fetch(
				`${baseUrl}/oracle/sessions/${encodeURIComponent(args["session-id"])}/chat/stream`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						message: args.message,
					} satisfies OracleSessionChatRequest),
				},
			);

			if (!response.ok || !response.body) {
				const status = response.status;
				if (status === 401 || status === 403) {
					console.error("Authentication failed — run `nia auth login` to authenticate.");
				} else if (status === 404) {
					console.error("Session not found. Check the session ID and try again.");
				} else {
					console.error(`Chat request failed with status ${status}`);
				}
				process.exit(1);
			}

			spinner.stop("Streaming chat response");

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
			spinner.stop("Failed to stream chat response");
			handleOracleError(error);
		}
	},
});

const deleteSessionCommand = defineCommand({
	meta: {
		name: "delete-session",
		description: "Delete an Oracle research session and its chat history",
	},
	args: [
		{
			name: "session-id",
			type: "string",
			description: "Oracle session ID to delete",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Deleting Oracle session...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await DefaultService.deleteOracleSessionV2OracleSessionsSessionIdDelete(
				args["session-id"],
			);

			spinner.stop("Oracle session deleted");

			if (global.output === "json") {
				fmt.output(result);
			} else {
				console.log(`Session ${args["session-id"]} and its chat history have been deleted.`);
			}
		} catch (error) {
			spinner.stop("Failed to delete Oracle session");
			handleOracleError(error);
		}
	},
});

const oracleUsageCommand = defineCommand({
	meta: {
		name: "1m-usage",
		description: "Show Oracle usage summary including 1M context operations",
	},
	args: [],
	flags: {},
	async run() {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Fetching Oracle usage...");

		try {
			await createSdk({ apiKey: global.apiKey });

			// Use the general usage endpoint — it includes Oracle operation counts
			const { V2ApiService } = await import("nia-ai-ts");
			const result = await V2ApiService.getUsageSummaryV2V2UsageGet();

			spinner.stop("Usage retrieved");

			if (global.output !== "json") {
				const usage = result as Record<string, unknown>;
				if (usage.subscription_tier) {
					console.log(`Plan: ${usage.subscription_tier}`);
				}
				if (usage.billing_period_start && usage.billing_period_end) {
					console.log(`Period: ${usage.billing_period_start} — ${usage.billing_period_end}`);
				}

				const ops = usage.usage as
					| Record<string, { used?: number; limit?: number; unlimited?: boolean }>
					| undefined;
				if (ops) {
					console.log("\nUsage breakdown:");
					for (const [key, entry] of Object.entries(ops)) {
						if (entry.unlimited) {
							console.log(`  ${key}: ${entry.used ?? 0} (unlimited)`);
						} else {
							const used = entry.used ?? 0;
							const limit = entry.limit ?? 0;
							const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
							console.log(`  ${key}: ${used}/${limit} (${pct}%)`);
						}
					}
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to fetch Oracle usage");
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
		stream: streamCommand,
		sessions: sessionsCommand,
		session: sessionCommand,
		messages: messagesCommand,
		chat: chatCommand,
		"delete-session": deleteSessionCommand,
		"1m-usage": oracleUsageCommand,
	},
});
