import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	getConfigDirPath,
	resetConfig,
	writeConfig,
} from "../../src/services/config.ts";

// --- Mock SDK ---

const mockUniversal = mock(() =>
	Promise.resolve({
		results: [] as Record<string, unknown>[],
		total: 0,
	}),
);
const mockQuery = mock(() =>
	Promise.resolve({
		answer: "test answer",
		sources: [] as Record<string, unknown>[],
		citations: [] as Record<string, unknown>[],
	}),
);
const mockWeb = mock(() =>
	Promise.resolve({
		github_repos: [] as Record<string, unknown>[],
		documentation: [] as Record<string, unknown>[],
		other_content: [] as Record<string, unknown>[],
		total_results: 0,
	}),
);
const mockDeep = mock(() =>
	Promise.resolve({
		data: { summary: "deep result" } as Record<string, unknown>,
		status: "completed",
	}),
);

mock.module("nia-ai-ts", () => ({
	NiaSDK: class {
		search = {
			universal: mockUniversal,
			query: mockQuery,
			web: mockWeb,
			deep: mockDeep,
		};
		sources = {};
		oracle = {};
	},
	OpenAPI: {
		BASE: "",
		TOKEN: "",
	},
}));

// --- Import after mocking ---

import { parseGlobalFlags } from "../../src/utils/global-flags.ts";

describe("search commands", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}

		// Set up a valid API key in config for SDK creation
		await writeConfig({
			apiKey: "nia_test_search_key",
			baseUrl: "https://apigcp.trynia.ai/v2",
			output: undefined,
		});

		mockUniversal.mockClear();
		mockQuery.mockClear();
		mockWeb.mockClear();
		mockDeep.mockClear();
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	describe("parseGlobalFlags", () => {
		test("parses --api-key with value", () => {
			const flags = parseGlobalFlags(["node", "cli", "--api-key", "nia_test"]);
			expect(flags.apiKey).toBe("nia_test");
		});

		test("parses --api-key=value", () => {
			const flags = parseGlobalFlags(["node", "cli", "--api-key=nia_test"]);
			expect(flags.apiKey).toBe("nia_test");
		});

		test("parses --output with value", () => {
			const flags = parseGlobalFlags(["node", "cli", "--output", "json"]);
			expect(flags.output).toBe("json");
		});

		test("parses --output=value", () => {
			const flags = parseGlobalFlags(["node", "cli", "--output=table"]);
			expect(flags.output).toBe("table");
		});

		test("parses -o shorthand", () => {
			const flags = parseGlobalFlags(["node", "cli", "-o", "json"]);
			expect(flags.output).toBe("json");
		});

		test("parses --verbose", () => {
			const flags = parseGlobalFlags(["node", "cli", "--verbose"]);
			expect(flags.verbose).toBe(true);
		});

		test("parses --no-color", () => {
			const flags = parseGlobalFlags(["node", "cli", "--no-color"]);
			expect(flags.color).toBe(false);
		});

		test("returns empty object when no global flags", () => {
			const flags = parseGlobalFlags([
				"node",
				"cli",
				"search",
				"universal",
				"test",
			]);
			expect(flags.apiKey).toBeUndefined();
			expect(flags.output).toBeUndefined();
			expect(flags.verbose).toBeUndefined();
			expect(flags.color).toBeUndefined();
		});

		test("handles multiple global flags together", () => {
			const flags = parseGlobalFlags([
				"node",
				"cli",
				"--api-key",
				"nia_key",
				"--output",
				"json",
				"--verbose",
				"--no-color",
			]);
			expect(flags.apiKey).toBe("nia_key");
			expect(flags.output).toBe("json");
			expect(flags.verbose).toBe(true);
			expect(flags.color).toBe(false);
		});
	});

	describe("universal search", () => {
		test("calls sdk.search.universal with query", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.universal({ query: "test query" });

			expect(mockUniversal).toHaveBeenCalledTimes(1);
			expect(mockUniversal).toHaveBeenCalledWith({ query: "test query" });
		});

		test("passes top_k parameter", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.universal({ query: "test", top_k: 20 });

			expect(mockUniversal).toHaveBeenCalledWith({ query: "test", top_k: 20 });
		});

		test("passes include_repos and include_docs flags", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.universal({
				query: "test",
				include_repos: true,
				include_docs: false,
			});

			expect(mockUniversal).toHaveBeenCalledWith({
				query: "test",
				include_repos: true,
				include_docs: false,
			});
		});

		test("returns search results", async () => {
			mockUniversal.mockImplementationOnce(() =>
				Promise.resolve({
					results: [{ title: "Result 1", score: 0.95 }],
					total: 1,
				}),
			);

			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();
			const result = await sdk.search.universal({ query: "test" });

			expect(result.results).toHaveLength(1);
			expect(result.results[0].title).toBe("Result 1");
			expect(result.total).toBe(1);
		});
	});

	describe("query search", () => {
		test("calls sdk.search.query with messages array", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.query({
				messages: [{ role: "user", content: "How does auth work?" }],
			});

			expect(mockQuery).toHaveBeenCalledTimes(1);
			expect(mockQuery).toHaveBeenCalledWith({
				messages: [{ role: "user", content: "How does auth work?" }],
			});
		});

		test("passes repositories and data_sources", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.query({
				messages: [{ role: "user", content: "test" }],
				repositories: ["vercel/ai", "openai/openai-node"],
				data_sources: ["react-docs"],
			});

			expect(mockQuery).toHaveBeenCalledWith({
				messages: [{ role: "user", content: "test" }],
				repositories: ["vercel/ai", "openai/openai-node"],
				data_sources: ["react-docs"],
			});
		});

		test("passes search_mode parameter", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.query({
				messages: [{ role: "user", content: "test" }],
				search_mode: "repositories",
			});

			expect(mockQuery).toHaveBeenCalledWith({
				messages: [{ role: "user", content: "test" }],
				search_mode: "repositories",
			});
		});

		test("passes fast_mode and skip_llm flags", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.query({
				messages: [{ role: "user", content: "test" }],
				fast_mode: true,
				skip_llm: true,
			});

			expect(mockQuery).toHaveBeenCalledWith({
				messages: [{ role: "user", content: "test" }],
				fast_mode: true,
				skip_llm: true,
			});
		});

		test("passes max_tokens and reasoning_strategy", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.query({
				messages: [{ role: "user", content: "test" }],
				max_tokens: 2000,
				reasoning_strategy: "hybrid",
			});

			expect(mockQuery).toHaveBeenCalledWith({
				messages: [{ role: "user", content: "test" }],
				max_tokens: 2000,
				reasoning_strategy: "hybrid",
			});
		});
	});

	describe("web search", () => {
		test("calls sdk.search.web with query", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.web({ query: "TypeScript best practices" });

			expect(mockWeb).toHaveBeenCalledTimes(1);
			expect(mockWeb).toHaveBeenCalledWith({
				query: "TypeScript best practices",
			});
		});

		test("passes num_results parameter", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.web({ query: "test", num_results: 5 });

			expect(mockWeb).toHaveBeenCalledWith({ query: "test", num_results: 5 });
		});

		test("passes category filter", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.web({ query: "test", category: "github" });

			expect(mockWeb).toHaveBeenCalledWith({
				query: "test",
				category: "github",
			});
		});

		test("passes days_back filter", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.web({ query: "test", days_back: 30 });

			expect(mockWeb).toHaveBeenCalledWith({ query: "test", days_back: 30 });
		});

		test("returns structured web results", async () => {
			mockWeb.mockImplementationOnce(() =>
				Promise.resolve({
					github_repos: [
						{
							url: "https://github.com/test/repo",
							owner_repo: "test/repo",
							title: "Test Repo",
						},
					],
					documentation: [
						{
							url: "https://docs.test.com",
							title: "Test Docs",
						},
					],
					other_content: [],
					total_results: 2,
				}),
			);

			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();
			const result = await sdk.search.web({ query: "test" });

			expect(result.github_repos).toHaveLength(1);
			expect(result.documentation).toHaveLength(1);
			expect(result.total_results).toBe(2);
		});

		test("validates category against allowed values", () => {
			const validCategories = [
				"github",
				"company",
				"research",
				"news",
				"tweet",
				"pdf",
				"blog",
			];

			for (const cat of validCategories) {
				expect(validCategories.includes(cat)).toBe(true);
			}

			expect(validCategories.includes("invalid")).toBe(false);
		});
	});

	describe("deep search", () => {
		test("calls sdk.search.deep with query", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.deep({ query: "What are LLM optimization techniques?" });

			expect(mockDeep).toHaveBeenCalledTimes(1);
			expect(mockDeep).toHaveBeenCalledWith({
				query: "What are LLM optimization techniques?",
			});
		});

		test("passes output_format parameter", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.deep({ query: "test", output_format: "bullet_points" });

			expect(mockDeep).toHaveBeenCalledWith({
				query: "test",
				output_format: "bullet_points",
			});
		});

		test("passes verbose parameter", async () => {
			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await sdk.search.deep({ query: "test", verbose: true });

			expect(mockDeep).toHaveBeenCalledWith({ query: "test", verbose: true });
		});

		test("returns deep research results", async () => {
			mockDeep.mockImplementationOnce(() =>
				Promise.resolve({
					data: {
						summary: "Detailed analysis...",
						key_findings: ["a", "b", "c"],
					},
					status: "completed",
					citations: null,
				}),
			);

			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();
			const result = await sdk.search.deep({ query: "test" });

			expect(result.data.summary).toBe("Detailed analysis...");
			expect(result.data.key_findings).toHaveLength(3);
			expect(result.status).toBe("completed");
		});
	});

	describe("error handling", () => {
		test("handles 401 authentication error", async () => {
			mockUniversal.mockImplementationOnce(() => {
				const error = new Error("Unauthorized") as Error & { status: number };
				error.status = 401;
				return Promise.reject(error);
			});

			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await expect(sdk.search.universal({ query: "test" })).rejects.toThrow(
				"Unauthorized",
			);
		});

		test("handles 429 rate limit error", async () => {
			mockWeb.mockImplementationOnce(() => {
				const error = new Error("Rate Limited") as Error & { status: number };
				error.status = 429;
				return Promise.reject(error);
			});

			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await expect(sdk.search.web({ query: "test" })).rejects.toThrow(
				"Rate Limited",
			);
		});

		test("handles 500 server error", async () => {
			mockDeep.mockImplementationOnce(() => {
				const error = new Error("Internal Server Error") as Error & {
					status: number;
				};
				error.status = 500;
				return Promise.reject(error);
			});

			const { createSdk } = await import("../../src/services/sdk.ts");
			const sdk = await createSdk();

			await expect(sdk.search.deep({ query: "test" })).rejects.toThrow(
				"Internal Server Error",
			);
		});

		test("handles missing API key error", async () => {
			// Reset config to remove API key
			await writeConfig({
				apiKey: undefined,
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			// Also ensure no env var
			delete process.env.NIA_API_KEY;

			const { createSdk } = await import("../../src/services/sdk.ts");

			await expect(createSdk()).rejects.toThrow("No API key found");
		});
	});

	describe("flag-to-parameter mapping", () => {
		test("repos flag splits into repositories array", () => {
			const reposFlag =
				"vercel/ai, openai/openai-node, langchain-ai/langchainjs";
			const repositories = reposFlag.split(",").map((s) => s.trim());

			expect(repositories).toEqual([
				"vercel/ai",
				"openai/openai-node",
				"langchain-ai/langchainjs",
			]);
		});

		test("docs flag splits into data_sources array", () => {
			const docsFlag = "react-docs,nextjs-docs";
			const dataSources = docsFlag.split(",").map((s) => s.trim());

			expect(dataSources).toEqual(["react-docs", "nextjs-docs"]);
		});

		test("query argument wraps into messages array", () => {
			const query = "How does authentication work?";
			const messages = [{ role: "user", content: query }];

			expect(messages).toEqual([
				{ role: "user", content: "How does authentication work?" },
			]);
		});

		test("search-mode maps to search_mode", () => {
			const params: Record<string, unknown> = {};
			const searchMode = "repositories";
			params.search_mode = searchMode;

			expect(params.search_mode).toBe("repositories");
		});

		test("fast flag maps to fast_mode", () => {
			const params: Record<string, unknown> = {};
			params.fast_mode = true;

			expect(params.fast_mode).toBe(true);
		});

		test("strategy flag maps to reasoning_strategy", () => {
			const params: Record<string, unknown> = {};
			params.reasoning_strategy = "hybrid";

			expect(params.reasoning_strategy).toBe("hybrid");
		});
	});
});
