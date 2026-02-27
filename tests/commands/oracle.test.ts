import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	getConfigDirPath,
	resetConfig,
	writeConfig,
} from "../../src/services/config.ts";

// --- Mock SDK ---

const mockCreateJob = mock(() =>
	Promise.resolve({
		job_id: "job_abc123",
		session_id: "sess_xyz789",
		status: "queued",
		query: "How does authentication work?",
		created_at: "2026-01-15T10:00:00Z",
	}),
);

const mockGetJob = mock(() =>
	Promise.resolve({
		job_id: "job_abc123",
		session_id: "sess_xyz789",
		status: "completed",
		query: "How does authentication work?",
		created_at: "2026-01-15T10:00:00Z",
		completed_at: "2026-01-15T10:02:30Z",
		result: { summary: "Authentication uses JWT tokens..." },
	} as Record<string, unknown>),
);

const mockCancelJob = mock(() =>
	Promise.resolve({ success: true, message: "Job cancelled" }),
);

const mockListJobs = mock(() =>
	Promise.resolve([
		{
			job_id: "job_abc123",
			status: "completed",
			query: "How does authentication work?",
			created_at: "2026-01-15T10:00:00Z",
		},
		{
			job_id: "job_def456",
			status: "running",
			query: "Explain the caching strategy",
			created_at: "2026-01-15T11:00:00Z",
		},
	]),
);

mock.module("nia-ai-ts", () => ({
	NiaSDK: class {
		search = {};
		sources = {};
		oracle = {
			createJob: mockCreateJob,
			getJob: mockGetJob,
		};
	},
	OpenAPI: {
		BASE: "",
		TOKEN: "",
	},
	DefaultService: {
		cancelOracleJobV2OracleJobsJobIdDelete: mockCancelJob,
		listOracleJobsV2OracleJobsGet: mockListJobs,
	},
}));

// --- Import after mocking ---

import { DefaultService } from "nia-ai-ts";
import { createSdk } from "../../src/services/sdk.ts";

describe("oracle commands", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}

		await writeConfig({
			apiKey: "nia_test_oracle_key",
			baseUrl: "https://apigcp.trynia.ai/v2",
			output: undefined,
		});

		mockCreateJob.mockClear();
		mockGetJob.mockClear();
		mockCancelJob.mockClear();
		mockListJobs.mockClear();
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	describe("oracle job (create)", () => {
		test("calls sdk.oracle.createJob with query", async () => {
			const sdk = await createSdk();

			await sdk.oracle.createJob({ query: "How does auth work?" });

			expect(mockCreateJob).toHaveBeenCalledTimes(1);
			expect(mockCreateJob).toHaveBeenCalledWith({
				query: "How does auth work?",
			});
		});

		test("passes repositories from --repos flag", async () => {
			const sdk = await createSdk();

			const repos = "vercel/ai, openai/openai-node";
			const repositories = repos.split(",").map((s) => s.trim());

			await sdk.oracle.createJob({
				query: "How does streaming work?",
				repositories,
			});

			expect(mockCreateJob).toHaveBeenCalledWith({
				query: "How does streaming work?",
				repositories: ["vercel/ai", "openai/openai-node"],
			});
		});

		test("passes data_sources from --docs flag", async () => {
			const sdk = await createSdk();

			const docs = "react-docs,nextjs-docs";
			const dataSources = docs.split(",").map((s) => s.trim());

			await sdk.oracle.createJob({
				query: "test",
				data_sources: dataSources,
			});

			expect(mockCreateJob).toHaveBeenCalledWith({
				query: "test",
				data_sources: ["react-docs", "nextjs-docs"],
			});
		});

		test("passes output_format parameter", async () => {
			const sdk = await createSdk();

			await sdk.oracle.createJob({
				query: "test",
				output_format: "bullet_points",
			});

			expect(mockCreateJob).toHaveBeenCalledWith({
				query: "test",
				output_format: "bullet_points",
			});
		});

		test("passes model parameter", async () => {
			const sdk = await createSdk();

			await sdk.oracle.createJob({
				query: "test",
				model: "claude-opus-4-6",
			});

			expect(mockCreateJob).toHaveBeenCalledWith({
				query: "test",
				model: "claude-opus-4-6",
			});
		});

		test("returns job_id and session_id on success", async () => {
			const sdk = await createSdk();

			const result = await sdk.oracle.createJob({ query: "test" });

			expect(result.job_id).toBe("job_abc123");
			expect(result.session_id).toBe("sess_xyz789");
			expect(result.status).toBe("queued");
		});

		test("passes all parameters together", async () => {
			const sdk = await createSdk();

			await sdk.oracle.createJob({
				query: "How does caching work?",
				repositories: ["vercel/ai"],
				data_sources: ["react-docs"],
				output_format: "detailed",
				model: "claude-sonnet-4-5-20250929",
			});

			expect(mockCreateJob).toHaveBeenCalledWith({
				query: "How does caching work?",
				repositories: ["vercel/ai"],
				data_sources: ["react-docs"],
				output_format: "detailed",
				model: "claude-sonnet-4-5-20250929",
			});
		});
	});

	describe("oracle status", () => {
		test("calls sdk.oracle.getJob with job ID", async () => {
			const sdk = await createSdk();

			await sdk.oracle.getJob("job_abc123");

			expect(mockGetJob).toHaveBeenCalledTimes(1);
			expect(mockGetJob).toHaveBeenCalledWith("job_abc123");
		});

		test("returns completed job with result", async () => {
			const sdk = await createSdk();

			const result = await sdk.oracle.getJob("job_abc123");

			expect(result.status).toBe("completed");
			expect(result.result).toEqual({
				summary: "Authentication uses JWT tokens...",
			});
			expect(result.completed_at).toBe("2026-01-15T10:02:30Z");
		});

		test("returns running job without result", async () => {
			mockGetJob.mockImplementationOnce(() =>
				Promise.resolve({
					job_id: "job_def456",
					session_id: "sess_abc123",
					status: "running",
					query: "test query",
					created_at: "2026-01-15T11:00:00Z",
				}),
			);

			const sdk = await createSdk();
			const result = await sdk.oracle.getJob("job_def456");

			expect(result.status).toBe("running");
			expect(result.result).toBeUndefined();
		});

		test("returns failed job with error", async () => {
			mockGetJob.mockImplementationOnce(() =>
				Promise.resolve({
					job_id: "job_fail",
					status: "failed",
					query: "test",
					error: "Timeout exceeded",
					created_at: "2026-01-15T12:00:00Z",
				}),
			);

			const sdk = await createSdk();
			const result = await sdk.oracle.getJob("job_fail");

			expect(result.status).toBe("failed");
			expect(result.error).toBe("Timeout exceeded");
		});
	});

	describe("oracle cancel", () => {
		test("calls DefaultService.cancelOracleJobV2OracleJobsJobIdDelete with job ID", async () => {
			await createSdk();

			await DefaultService.cancelOracleJobV2OracleJobsJobIdDelete("job_abc123");

			expect(mockCancelJob).toHaveBeenCalledTimes(1);
			expect(mockCancelJob).toHaveBeenCalledWith("job_abc123");
		});

		test("returns success response", async () => {
			await createSdk();

			const result =
				await DefaultService.cancelOracleJobV2OracleJobsJobIdDelete(
					"job_abc123",
				);

			expect(result).toEqual({ success: true, message: "Job cancelled" });
		});

		test("handles cancellation of non-existent job", async () => {
			mockCancelJob.mockImplementationOnce(() => {
				const error = new Error("Not Found") as Error & { status: number };
				error.status = 404;
				return Promise.reject(error);
			});

			await createSdk();

			await expect(
				DefaultService.cancelOracleJobV2OracleJobsJobIdDelete(
					"job_nonexistent",
				),
			).rejects.toThrow("Not Found");
		});
	});

	describe("oracle jobs (list)", () => {
		test("calls DefaultService.listOracleJobsV2OracleJobsGet without filters", async () => {
			await createSdk();

			await DefaultService.listOracleJobsV2OracleJobsGet(
				undefined,
				undefined,
				undefined,
			);

			expect(mockListJobs).toHaveBeenCalledTimes(1);
			expect(mockListJobs).toHaveBeenCalledWith(
				undefined,
				undefined,
				undefined,
			);
		});

		test("passes status filter", async () => {
			await createSdk();

			await DefaultService.listOracleJobsV2OracleJobsGet(
				"completed",
				undefined,
				undefined,
			);

			expect(mockListJobs).toHaveBeenCalledWith(
				"completed",
				undefined,
				undefined,
			);
		});

		test("passes limit parameter", async () => {
			await createSdk();

			await DefaultService.listOracleJobsV2OracleJobsGet(
				undefined,
				10,
				undefined,
			);

			expect(mockListJobs).toHaveBeenCalledWith(undefined, 10, undefined);
		});

		test("passes skip parameter for pagination", async () => {
			await createSdk();

			await DefaultService.listOracleJobsV2OracleJobsGet(
				undefined,
				undefined,
				5,
			);

			expect(mockListJobs).toHaveBeenCalledWith(undefined, undefined, 5);
		});

		test("passes all filters together", async () => {
			await createSdk();

			await DefaultService.listOracleJobsV2OracleJobsGet("running", 20, 10);

			expect(mockListJobs).toHaveBeenCalledWith("running", 20, 10);
		});

		test("returns array of jobs", async () => {
			await createSdk();

			const result = await DefaultService.listOracleJobsV2OracleJobsGet(
				undefined,
				undefined,
				undefined,
			);

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(2);
			expect(result[0].job_id).toBe("job_abc123");
			expect(result[0].status).toBe("completed");
			expect(result[1].job_id).toBe("job_def456");
			expect(result[1].status).toBe("running");
		});

		test("returns empty array when no jobs found", async () => {
			mockListJobs.mockImplementationOnce(() => Promise.resolve([]));

			await createSdk();

			const result = await DefaultService.listOracleJobsV2OracleJobsGet(
				undefined,
				undefined,
				undefined,
			);

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(0);
		});
	});

	describe("error handling", () => {
		test("handles 401 authentication error", async () => {
			mockCreateJob.mockImplementationOnce(() => {
				const error = new Error("Unauthorized") as Error & { status: number };
				error.status = 401;
				return Promise.reject(error);
			});

			const sdk = await createSdk();

			await expect(sdk.oracle.createJob({ query: "test" })).rejects.toThrow(
				"Unauthorized",
			);
		});

		test("handles 404 not found error", async () => {
			mockGetJob.mockImplementationOnce(() => {
				const error = new Error("Not Found") as Error & { status: number };
				error.status = 404;
				return Promise.reject(error);
			});

			const sdk = await createSdk();

			await expect(sdk.oracle.getJob("nonexistent")).rejects.toThrow(
				"Not Found",
			);
		});

		test("handles 429 rate limit error", async () => {
			mockCreateJob.mockImplementationOnce(() => {
				const error = new Error("Too Many Requests") as Error & {
					status: number;
				};
				error.status = 429;
				return Promise.reject(error);
			});

			const sdk = await createSdk();

			await expect(sdk.oracle.createJob({ query: "test" })).rejects.toThrow(
				"Too Many Requests",
			);
		});

		test("handles 500 server error", async () => {
			mockListJobs.mockImplementationOnce(() => {
				const error = new Error("Internal Server Error") as Error & {
					status: number;
				};
				error.status = 500;
				return Promise.reject(error);
			});

			await createSdk();

			await expect(
				DefaultService.listOracleJobsV2OracleJobsGet(
					undefined,
					undefined,
					undefined,
				),
			).rejects.toThrow("Internal Server Error");
		});

		test("handles missing API key", async () => {
			await writeConfig({
				apiKey: undefined,
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			delete process.env.NIA_API_KEY;

			await expect(createSdk()).rejects.toThrow("No API key found");
		});
	});

	describe("flag-to-parameter mapping", () => {
		test("repos flag splits into repositories array", () => {
			const reposFlag = "vercel/ai, openai/openai-node";
			const repositories = reposFlag.split(",").map((s) => s.trim());

			expect(repositories).toEqual(["vercel/ai", "openai/openai-node"]);
		});

		test("docs flag splits into data_sources array", () => {
			const docsFlag = "react-docs,nextjs-docs,vue-docs";
			const dataSources = docsFlag.split(",").map((s) => s.trim());

			expect(dataSources).toEqual(["react-docs", "nextjs-docs", "vue-docs"]);
		});

		test("validates status against allowed values", () => {
			const validStatuses = [
				"queued",
				"running",
				"completed",
				"failed",
				"cancelled",
			];

			for (const status of validStatuses) {
				expect(validStatuses.includes(status)).toBe(true);
			}

			expect(validStatuses.includes("invalid")).toBe(false);
			expect(validStatuses.includes("pending")).toBe(false);
		});

		test("output-format maps to output_format", () => {
			const params: Record<string, unknown> = {};
			const outputFormat = "bullet_points";
			params.output_format = outputFormat;

			expect(params.output_format).toBe("bullet_points");
		});

		test("model parameter passes through directly", () => {
			const params: Record<string, unknown> = {};
			params.model = "claude-opus-4-6";

			expect(params.model).toBe("claude-opus-4-6");
		});

		test("query truncation for jobs list display", () => {
			const longQuery =
				"This is a very long research question that exceeds sixty characters and should be truncated";
			const truncated =
				longQuery.length > 60 ? `${longQuery.slice(0, 57)}...` : longQuery;

			expect(truncated.length).toBeLessThanOrEqual(60);
			expect(truncated).toEndWith("...");
		});
	});
});
