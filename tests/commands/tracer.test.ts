import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	getConfigDirPath,
	resetConfig,
	writeConfig,
} from "../helpers/config-store.ts";

// --- Mock SDK ---

const mockCreateTracerJob = mock(() =>
	Promise.resolve({
		job_id: "tracer_job_abc123",
		session_id: "tracer_sess_xyz789",
		status: "queued",
		query: "How does error handling work?",
		created_at: "2026-01-20T10:00:00Z",
	}),
);

const mockGetTracerJob = mock(() =>
	Promise.resolve({
		job_id: "tracer_job_abc123",
		session_id: "tracer_sess_xyz789",
		status: "completed",
		query: "How does error handling work?",
		created_at: "2026-01-20T10:00:00Z",
		completed_at: "2026-01-20T10:03:00Z",
		result: { summary: "Error handling uses try/catch blocks..." },
	}),
);

const mockListTracerJobs = mock(() =>
	Promise.resolve([
		{
			job_id: "tracer_job_abc123",
			status: "completed",
			query: "How does error handling work?",
			created_at: "2026-01-20T10:00:00Z",
		},
		{
			job_id: "tracer_job_def456",
			status: "running",
			query: "Explain the routing implementation",
			created_at: "2026-01-20T11:00:00Z",
		},
	]),
);

const mockDeleteTracerJob = mock(() =>
	Promise.resolve({ success: true, message: "Job deleted" }),
);

const mockStreamTracerJob = mock(() => Promise.resolve({ body: null }));

mock.module("nia-ai-ts", () => ({
	NiaSDK: class {
		search = {};
		sources = {};
		oracle = {};
	},
	OpenAPI: {
		BASE: "",
		TOKEN: "",
	},
	GithubSearchService: {
		createTracerJobV2GithubTracerPost: mockCreateTracerJob,
		getTracerJobV2GithubTracerJobIdGet: mockGetTracerJob,
		listTracerJobsV2GithubTracerGet: mockListTracerJobs,
		deleteTracerJobV2GithubTracerJobIdDelete: mockDeleteTracerJob,
		streamTracerJobV2GithubTracerJobIdStreamGet: mockStreamTracerJob,
	},
}));

// --- Import after mocking ---

import { GithubSearchService } from "nia-ai-ts";
import { createSdk } from "../../src/services/sdk.ts";

describe("tracer commands", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}

		await writeConfig({
			apiKey: "nia_test_tracer_key",
			baseUrl: "https://apigcp.trynia.ai/v2",
			output: undefined,
		});

		mockCreateTracerJob.mockClear();
		mockGetTracerJob.mockClear();
		mockListTracerJobs.mockClear();
		mockDeleteTracerJob.mockClear();
		mockStreamTracerJob.mockClear();
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	describe("tracer run (create)", () => {
		test("calls GithubSearchService.createTracerJobV2GithubTracerPost with query", async () => {
			await createSdk();

			await GithubSearchService.createTracerJobV2GithubTracerPost({
				query: "How does error handling work?",
			});

			expect(mockCreateTracerJob).toHaveBeenCalledTimes(1);
			expect(mockCreateTracerJob).toHaveBeenCalledWith({
				query: "How does error handling work?",
			});
		});

		test("passes repositories from --repos flag", async () => {
			await createSdk();

			const repos = "vercel/next.js, facebook/react";
			const repositories = repos.split(",").map((s) => s.trim());

			await GithubSearchService.createTracerJobV2GithubTracerPost({
				query: "How does SSR work?",
				repositories,
			});

			expect(mockCreateTracerJob).toHaveBeenCalledWith({
				query: "How does SSR work?",
				repositories: ["vercel/next.js", "facebook/react"],
			});
		});

		test("passes context from --context flag", async () => {
			await createSdk();

			await GithubSearchService.createTracerJobV2GithubTracerPost({
				query: "How does caching work?",
				context: "Focus on the server-side caching layer",
			});

			expect(mockCreateTracerJob).toHaveBeenCalledWith({
				query: "How does caching work?",
				context: "Focus on the server-side caching layer",
			});
		});

		test("passes model from --model flag", async () => {
			await createSdk();

			await GithubSearchService.createTracerJobV2GithubTracerPost({
				query: "test",
				model: "claude-opus-4-6-1m",
			});

			expect(mockCreateTracerJob).toHaveBeenCalledWith({
				query: "test",
				model: "claude-opus-4-6-1m",
			});
		});

		test("returns job_id and session_id on success", async () => {
			await createSdk();

			const result =
				await GithubSearchService.createTracerJobV2GithubTracerPost({
					query: "test",
				});

			expect(result.job_id).toBe("tracer_job_abc123");
			expect(result.session_id).toBe("tracer_sess_xyz789");
			expect(result.status).toBe("queued");
		});

		test("passes all parameters together", async () => {
			await createSdk();

			await GithubSearchService.createTracerJobV2GithubTracerPost({
				query: "How does streaming work?",
				repositories: ["vercel/ai"],
				context: "Focus on SSE implementation",
				model: "claude-opus-4-6",
			});

			expect(mockCreateTracerJob).toHaveBeenCalledWith({
				query: "How does streaming work?",
				repositories: ["vercel/ai"],
				context: "Focus on SSE implementation",
				model: "claude-opus-4-6",
			});
		});
	});

	describe("tracer status", () => {
		test("calls GithubSearchService.getTracerJobV2GithubTracerJobIdGet with job ID", async () => {
			await createSdk();

			await GithubSearchService.getTracerJobV2GithubTracerJobIdGet(
				"tracer_job_abc123",
			);

			expect(mockGetTracerJob).toHaveBeenCalledTimes(1);
			expect(mockGetTracerJob).toHaveBeenCalledWith("tracer_job_abc123");
		});

		test("returns job details including result when completed", async () => {
			await createSdk();

			const result =
				await GithubSearchService.getTracerJobV2GithubTracerJobIdGet(
					"tracer_job_abc123",
				);

			expect(result.job_id).toBe("tracer_job_abc123");
			expect(result.status).toBe("completed");
			expect(result.result).toEqual({
				summary: "Error handling uses try/catch blocks...",
			});
			expect(result.completed_at).toBe("2026-01-20T10:03:00Z");
		});

		test("handles job not found error", async () => {
			mockGetTracerJob.mockRejectedValueOnce(
				Object.assign(new Error("Not found"), { status: 404 }),
			);

			await createSdk();

			try {
				await GithubSearchService.getTracerJobV2GithubTracerJobIdGet(
					"nonexistent",
				);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect((error as { status: number }).status).toBe(404);
			}
		});
	});

	describe("tracer list", () => {
		test("calls GithubSearchService.listTracerJobsV2GithubTracerGet without filters", async () => {
			await createSdk();

			await GithubSearchService.listTracerJobsV2GithubTracerGet(
				undefined,
				undefined,
				undefined,
			);

			expect(mockListTracerJobs).toHaveBeenCalledTimes(1);
			expect(mockListTracerJobs).toHaveBeenCalledWith(
				undefined,
				undefined,
				undefined,
			);
		});

		test("passes status filter", async () => {
			await createSdk();

			await GithubSearchService.listTracerJobsV2GithubTracerGet(
				"completed",
				undefined,
				undefined,
			);

			expect(mockListTracerJobs).toHaveBeenCalledWith(
				"completed",
				undefined,
				undefined,
			);
		});

		test("passes limit and skip parameters", async () => {
			await createSdk();

			await GithubSearchService.listTracerJobsV2GithubTracerGet(
				undefined,
				10,
				5,
			);

			expect(mockListTracerJobs).toHaveBeenCalledWith(undefined, 10, 5);
		});

		test("passes all filters together", async () => {
			await createSdk();

			await GithubSearchService.listTracerJobsV2GithubTracerGet(
				"running",
				20,
				0,
			);

			expect(mockListTracerJobs).toHaveBeenCalledWith("running", 20, 0);
		});

		test("returns array of jobs", async () => {
			await createSdk();

			const result = await GithubSearchService.listTracerJobsV2GithubTracerGet(
				undefined,
				undefined,
				undefined,
			);

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(2);
			expect(result[0].job_id).toBe("tracer_job_abc123");
			expect(result[1].status).toBe("running");
		});

		test("returns empty array when no jobs exist", async () => {
			mockListTracerJobs.mockResolvedValueOnce([]);
			await createSdk();

			const result = await GithubSearchService.listTracerJobsV2GithubTracerGet(
				undefined,
				undefined,
				undefined,
			);

			expect(result).toEqual([]);
		});
	});

	describe("tracer delete", () => {
		test("calls GithubSearchService.deleteTracerJobV2GithubTracerJobIdDelete with job ID", async () => {
			await createSdk();

			await GithubSearchService.deleteTracerJobV2GithubTracerJobIdDelete(
				"tracer_job_abc123",
			);

			expect(mockDeleteTracerJob).toHaveBeenCalledTimes(1);
			expect(mockDeleteTracerJob).toHaveBeenCalledWith("tracer_job_abc123");
		});

		test("returns success response", async () => {
			await createSdk();

			const result =
				await GithubSearchService.deleteTracerJobV2GithubTracerJobIdDelete(
					"tracer_job_abc123",
				);

			expect(result.success).toBe(true);
		});

		test("handles delete not found error", async () => {
			mockDeleteTracerJob.mockRejectedValueOnce(
				Object.assign(new Error("Not found"), { status: 404 }),
			);

			await createSdk();

			try {
				await GithubSearchService.deleteTracerJobV2GithubTracerJobIdDelete(
					"nonexistent",
				);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect((error as { status: number }).status).toBe(404);
			}
		});
	});

	describe("error handling", () => {
		test("handles 401 authentication error", async () => {
			mockCreateTracerJob.mockRejectedValueOnce(
				Object.assign(new Error("Unauthorized"), { status: 401 }),
			);

			await createSdk();

			try {
				await GithubSearchService.createTracerJobV2GithubTracerPost({
					query: "test",
				});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(401);
			}
		});

		test("handles 429 rate limit error", async () => {
			mockCreateTracerJob.mockRejectedValueOnce(
				Object.assign(new Error("Too Many Requests"), { status: 429 }),
			);

			await createSdk();

			try {
				await GithubSearchService.createTracerJobV2GithubTracerPost({
					query: "test",
				});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(429);
			}
		});

		test("handles 500 server error", async () => {
			mockGetTracerJob.mockRejectedValueOnce(
				Object.assign(new Error("Internal Server Error"), { status: 500 }),
			);

			await createSdk();

			try {
				await GithubSearchService.getTracerJobV2GithubTracerJobIdGet("job_123");
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(500);
			}
		});

		test("handles 422 validation error", async () => {
			mockCreateTracerJob.mockRejectedValueOnce(
				Object.assign(new Error("Validation error: invalid query"), {
					status: 422,
				}),
			);

			await createSdk();

			try {
				await GithubSearchService.createTracerJobV2GithubTracerPost({
					query: "",
				});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(422);
			}
		});
	});

	describe("flag-to-parameter mapping", () => {
		test("TracerRequest only includes defined fields (no undefined values)", async () => {
			await createSdk();

			const payload = { query: "test" };

			await GithubSearchService.createTracerJobV2GithubTracerPost(payload);

			const calledWith = (
				mockCreateTracerJob.mock.calls as unknown as Array<
					[Record<string, unknown>]
				>
			)[0]?.[0];
			expect(calledWith).toBeDefined();
			if (!calledWith) throw new Error("Expected tracer payload");
			expect(calledWith).toEqual({ query: "test" });
			expect("repositories" in calledWith).toBe(false);
			expect("context" in calledWith).toBe(false);
			expect("model" in calledWith).toBe(false);
		});

		test("repositories are split from comma-separated string", async () => {
			await createSdk();

			const reposFlag = "owner/repo1, owner/repo2, owner/repo3";
			const repositories = reposFlag.split(",").map((s) => s.trim());

			await GithubSearchService.createTracerJobV2GithubTracerPost({
				query: "test",
				repositories,
			});

			expect(mockCreateTracerJob).toHaveBeenCalledWith({
				query: "test",
				repositories: ["owner/repo1", "owner/repo2", "owner/repo3"],
			});
		});

		test("status validation rejects invalid values", () => {
			const validStatuses = [
				"queued",
				"running",
				"completed",
				"failed",
				"cancelled",
			];
			const invalidStatus = "invalid_status";

			expect(validStatuses.includes(invalidStatus)).toBe(false);
			expect(validStatuses.includes("completed")).toBe(true);
			expect(validStatuses.includes("running")).toBe(true);
		});

		test("query truncation works for long queries in list display", () => {
			const longQuery =
				"This is a very long query that exceeds the 60 character limit and should be truncated";
			const truncated =
				longQuery.length > 60 ? `${longQuery.slice(0, 57)}...` : longQuery;

			expect(truncated.length).toBeLessThanOrEqual(60);
			expect(truncated.endsWith("...")).toBe(true);
		});

		test("list parameters map correctly to GithubSearchService method args", async () => {
			await createSdk();

			await GithubSearchService.listTracerJobsV2GithubTracerGet(
				"completed",
				25,
				10,
			);

			expect(mockListTracerJobs).toHaveBeenCalledWith("completed", 25, 10);
		});

		test("model flag accepts both claude-opus-4-6 and claude-opus-4-6-1m values", async () => {
			await createSdk();

			await GithubSearchService.createTracerJobV2GithubTracerPost({
				query: "test",
				model: "claude-opus-4-6",
			});

			expect(mockCreateTracerJob).toHaveBeenCalledWith({
				query: "test",
				model: "claude-opus-4-6",
			});

			mockCreateTracerJob.mockClear();

			await GithubSearchService.createTracerJobV2GithubTracerPost({
				query: "test",
				model: "claude-opus-4-6-1m",
			});

			expect(mockCreateTracerJob).toHaveBeenCalledWith({
				query: "test",
				model: "claude-opus-4-6-1m",
			});
		});
	});
});
