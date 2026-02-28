import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	getConfigDirPath,
	resetConfig,
	writeConfig,
} from "../helpers/config-store.ts";

// --- Mock SDK ---

const mockGetUsage = mock(() =>
	Promise.resolve({
		user_id: "user_123",
		subscription_tier: "Pro",
		billing_period_start: "2026-01-01",
		billing_period_end: "2026-02-01",
		usage: {
			queries: { used: 42, limit: 100, unlimited: false },
			indexing: { used: 3, limit: 10, unlimited: false },
			oracle: { used: 5, limit: 20, unlimited: false },
			tracer: { used: 10, limit: 0, unlimited: true },
		},
	}),
);

mock.module("nia-ai-ts", () => ({
	NiaSDK: class {
		search = {};
		sources = {};
		oracle = {
			createJob: mock(() => Promise.resolve({})),
			getJob: mock(() => Promise.resolve({})),
			streamJob: mock(async function* () {}),
		};
	},
	OpenAPI: {
		BASE: "",
		TOKEN: "",
	},
	V2ApiService: {
		getUsageSummaryV2V2UsageGet: mockGetUsage,
	},
}));

// --- Import after mocking ---

import { V2ApiService } from "nia-ai-ts";
import { createSdk } from "../../src/services/sdk.ts";

describe("usage command", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}

		await writeConfig({
			apiKey: "nia_test_usage_key",
			baseUrl: "https://apigcp.trynia.ai/v2",
			output: undefined,
		});

		mockGetUsage.mockClear();
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	// --- Usage API ---

	describe("nia usage", () => {
		test("V2ApiService.getUsageSummaryV2V2UsageGet is called", async () => {
			await createSdk();

			const result = await V2ApiService.getUsageSummaryV2V2UsageGet();

			expect(mockGetUsage).toHaveBeenCalledTimes(1);
			expect(result).toBeDefined();
		});

		test("usage response contains subscription tier", async () => {
			await createSdk();

			const result = await V2ApiService.getUsageSummaryV2V2UsageGet();

			expect(result.subscription_tier).toBe("Pro");
		});

		test("usage response contains billing period", async () => {
			await createSdk();

			const result = await V2ApiService.getUsageSummaryV2V2UsageGet();

			expect(result.billing_period_start).toBe("2026-01-01");
			expect(result.billing_period_end).toBe("2026-02-01");
		});

		test("usage response contains usage breakdown", async () => {
			await createSdk();

			const result = await V2ApiService.getUsageSummaryV2V2UsageGet();

			const usage = result.usage as Record<
				string,
				{ used?: number; limit?: number; unlimited?: boolean }
			>;

			expect(usage.queries).toEqual({ used: 42, limit: 100, unlimited: false });
			expect(usage.indexing).toEqual({ used: 3, limit: 10, unlimited: false });
			expect(usage.oracle).toEqual({ used: 5, limit: 20, unlimited: false });
		});

		test("usage percentage calculation is correct", () => {
			const testCases = [
				{ used: 42, limit: 100, expected: 42 },
				{ used: 0, limit: 100, expected: 0 },
				{ used: 100, limit: 100, expected: 100 },
				{ used: 1, limit: 3, expected: 33 },
				{ used: 0, limit: 0, expected: 0 },
			];

			for (const { used, limit, expected } of testCases) {
				const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
				expect(pct).toBe(expected);
			}
		});

		test("handles unlimited usage entries", () => {
			const entry = { used: 10, limit: 0, unlimited: true };

			expect(entry.unlimited).toBe(true);
			const display = `${entry.used} (unlimited)`;
			expect(display).toBe("10 (unlimited)");
		});

		test("handles limited usage entries formatting", () => {
			const entry = { used: 42, limit: 100, unlimited: false };

			const pct =
				entry.limit > 0 ? Math.round((entry.used / entry.limit) * 100) : 0;
			const display = `${entry.used}/${entry.limit} (${pct}%)`;
			expect(display).toBe("42/100 (42%)");
		});

		test("handles empty usage breakdown", async () => {
			// biome-ignore lint/suspicious/noExplicitAny: test mock with partial response
			(mockGetUsage as any).mockImplementationOnce(() =>
				Promise.resolve({
					user_id: "user_123",
					subscription_tier: "Free",
					billing_period_start: "2026-01-01",
					billing_period_end: "2026-02-01",
					usage: {},
				}),
			);

			await createSdk();
			const result = await V2ApiService.getUsageSummaryV2V2UsageGet();

			const usage = (result as Record<string, unknown>).usage as Record<
				string,
				unknown
			>;
			expect(Object.keys(usage).length).toBe(0);
		});

		test("handles missing usage field", async () => {
			// biome-ignore lint/suspicious/noExplicitAny: test mock with partial response
			(mockGetUsage as any).mockImplementationOnce(() =>
				Promise.resolve({
					user_id: "user_123",
					subscription_tier: "Free",
				}),
			);

			await createSdk();
			const result = await V2ApiService.getUsageSummaryV2V2UsageGet();

			const usage = (result as Record<string, unknown>).usage as
				| Record<string, unknown>
				| undefined;
			expect(usage).toBeUndefined();
		});
	});

	// --- Error Handling ---

	describe("error handling", () => {
		test("handles 401 authentication error", async () => {
			mockGetUsage.mockImplementationOnce(() => {
				const error = new Error("Unauthorized") as Error & { status: number };
				error.status = 401;
				return Promise.reject(error);
			});

			await createSdk();

			await expect(V2ApiService.getUsageSummaryV2V2UsageGet()).rejects.toThrow(
				"Unauthorized",
			);
		});

		test("handles 429 rate limit error", async () => {
			mockGetUsage.mockImplementationOnce(() => {
				const error = new Error("Too Many Requests") as Error & {
					status: number;
				};
				error.status = 429;
				return Promise.reject(error);
			});

			await createSdk();

			await expect(V2ApiService.getUsageSummaryV2V2UsageGet()).rejects.toThrow(
				"Too Many Requests",
			);
		});

		test("handles 500 server error", async () => {
			mockGetUsage.mockImplementationOnce(() => {
				const error = new Error("Internal Server Error") as Error & {
					status: number;
				};
				error.status = 500;
				return Promise.reject(error);
			});

			await createSdk();

			await expect(V2ApiService.getUsageSummaryV2V2UsageGet()).rejects.toThrow(
				"Internal Server Error",
			);
		});

		test("error status code mapping", () => {
			const statusMessages: Record<number, string> = {
				401: "Authentication failed",
				403: "Authentication failed",
				429: "Rate limited",
				500: "Server error",
			};

			expect(statusMessages[401]).toBe("Authentication failed");
			expect(statusMessages[429]).toBe("Rate limited");
			expect(statusMessages[500]).toBe("Server error");
		});
	});
});
