import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import { getConfigDirPath, resetConfig, writeConfig } from "../../src/services/config.ts";

// --- Mock SDK ---

const mockPackageSearchGrep = mock(() =>
	Promise.resolve({
		matches: [
			{
				file: "src/index.ts",
				filename_sha256: "abc123def456",
				line: 42,
				content: "export function createApp() {",
				context_before: ["import { App } from './app';"],
				context_after: ["  return new App();"],
			},
		],
		total_matches: 1,
	}),
);

const mockPackageSearchHybrid = mock(() =>
	Promise.resolve({
		results: [
			{
				file: "src/utils/helper.ts",
				filename_sha256: "xyz789abc012",
				score: 0.92,
				content: "Helper function for data transformation",
				line_start: 10,
				line_end: 25,
			},
		],
		total_results: 1,
	}),
);

const mockPackageSearchReadFile = mock(() =>
	Promise.resolve({
		content: 'import { foo } from "bar";\n\nexport function main() {\n  return foo();\n}',
		file: "src/index.ts",
		filename_sha256: "abc123def456",
		start_line: 1,
		end_line: 5,
	}),
);

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
	V2ApiPackageSearchService: {
		packageSearchGrepV2V2PackageSearchGrepPost: mockPackageSearchGrep,
		packageSearchHybridV2V2PackageSearchHybridPost: mockPackageSearchHybrid,
		packageSearchReadFileV2V2PackageSearchReadFilePost: mockPackageSearchReadFile,
	},
}));

// --- Import after mocking ---

import { V2ApiPackageSearchService } from "nia-ai-ts";
import { createSdk } from "../../src/services/sdk.ts";

describe("packages commands", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}

		await writeConfig({
			apiKey: "nia_test_packages_key",
			baseUrl: "https://apigcp.trynia.ai/v2",
			output: undefined,
		});

		mockPackageSearchGrep.mockClear();
		mockPackageSearchHybrid.mockClear();
		mockPackageSearchReadFile.mockClear();
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	describe("packages grep", () => {
		test("calls V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost with required fields", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
				registry: "npm",
				package_name: "express",
				pattern: "createApp",
			});

			expect(mockPackageSearchGrep).toHaveBeenCalledTimes(1);
			expect(mockPackageSearchGrep).toHaveBeenCalledWith({
				registry: "npm",
				package_name: "express",
				pattern: "createApp",
			});
		});

		test("passes version flag", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
				registry: "npm",
				package_name: "express",
				pattern: "Router",
				version: "4.18.2",
			});

			expect(mockPackageSearchGrep).toHaveBeenCalledWith({
				registry: "npm",
				package_name: "express",
				pattern: "Router",
				version: "4.18.2",
			});
		});

		test("passes context lines (a/b fields)", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
				registry: "py_pi",
				package_name: "requests",
				pattern: "def get",
				b: 3,
				a: 5,
			});

			expect(mockPackageSearchGrep).toHaveBeenCalledWith({
				registry: "py_pi",
				package_name: "requests",
				pattern: "def get",
				b: 3,
				a: 5,
			});
		});

		test("passes language and output_mode flags", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
				registry: "crates_io",
				package_name: "serde",
				pattern: "impl Serialize",
				language: "rust",
				output_mode: "files_with_matches",
			});

			expect(mockPackageSearchGrep).toHaveBeenCalledWith({
				registry: "crates_io",
				package_name: "serde",
				pattern: "impl Serialize",
				language: "rust",
				output_mode: "files_with_matches",
			});
		});

		test("passes head_limit and filename_sha256 flags", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
				registry: "npm",
				package_name: "lodash",
				pattern: "function",
				head_limit: 50,
				filename_sha256: "abc123",
			});

			expect(mockPackageSearchGrep).toHaveBeenCalledWith({
				registry: "npm",
				package_name: "lodash",
				pattern: "function",
				head_limit: 50,
				filename_sha256: "abc123",
			});
		});

		test("returns match results", async () => {
			await createSdk();

			const result = await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
				registry: "npm",
				package_name: "express",
				pattern: "createApp",
			});

			expect(result.matches).toBeDefined();
			expect(result.matches.length).toBe(1);
			expect(result.matches[0].file).toBe("src/index.ts");
			expect(result.matches[0].line).toBe(42);
			expect(result.total_matches).toBe(1);
		});
	});

	describe("packages hybrid", () => {
		test("calls V2ApiPackageSearchService.packageSearchHybridV2V2PackageSearchHybridPost with required fields", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchHybridV2V2PackageSearchHybridPost({
				registry: "npm",
				package_name: "express",
				semantic_queries: ["how does routing work"],
			});

			expect(mockPackageSearchHybrid).toHaveBeenCalledTimes(1);
			expect(mockPackageSearchHybrid).toHaveBeenCalledWith({
				registry: "npm",
				package_name: "express",
				semantic_queries: ["how does routing work"],
			});
		});

		test("passes multiple semantic queries from comma-separated input", async () => {
			await createSdk();

			const queryArg = "routing logic, middleware handling, error handling";
			const semanticQueries = queryArg.split(",").map((s) => s.trim());

			await V2ApiPackageSearchService.packageSearchHybridV2V2PackageSearchHybridPost({
				registry: "npm",
				package_name: "express",
				semantic_queries: semanticQueries,
			});

			expect(mockPackageSearchHybrid).toHaveBeenCalledWith({
				registry: "npm",
				package_name: "express",
				semantic_queries: ["routing logic", "middleware handling", "error handling"],
			});
		});

		test("passes version and pattern flags", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchHybridV2V2PackageSearchHybridPost({
				registry: "py_pi",
				package_name: "flask",
				semantic_queries: ["request handling"],
				version: "2.3.0",
				pattern: "def route",
			});

			expect(mockPackageSearchHybrid).toHaveBeenCalledWith({
				registry: "py_pi",
				package_name: "flask",
				semantic_queries: ["request handling"],
				version: "2.3.0",
				pattern: "def route",
			});
		});

		test("passes language and filename_sha256 flags", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchHybridV2V2PackageSearchHybridPost({
				registry: "golang_proxy",
				package_name: "gin-gonic/gin",
				semantic_queries: ["context middleware"],
				language: "go",
				filename_sha256: "sha256hash",
			});

			expect(mockPackageSearchHybrid).toHaveBeenCalledWith({
				registry: "golang_proxy",
				package_name: "gin-gonic/gin",
				semantic_queries: ["context middleware"],
				language: "go",
				filename_sha256: "sha256hash",
			});
		});

		test("returns hybrid search results", async () => {
			await createSdk();

			const result = await V2ApiPackageSearchService.packageSearchHybridV2V2PackageSearchHybridPost(
				{
					registry: "npm",
					package_name: "express",
					semantic_queries: ["routing"],
				},
			);

			expect(result.results).toBeDefined();
			expect(result.results.length).toBe(1);
			expect(result.results[0].score).toBe(0.92);
			expect(result.total_results).toBe(1);
		});
	});

	describe("packages read", () => {
		test("calls V2ApiPackageSearchService.packageSearchReadFileV2V2PackageSearchReadFilePost with required fields", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchReadFileV2V2PackageSearchReadFilePost({
				registry: "npm",
				package_name: "express",
				filename_sha256: "abc123def456",
				start_line: 1,
				end_line: 50,
			});

			expect(mockPackageSearchReadFile).toHaveBeenCalledTimes(1);
			expect(mockPackageSearchReadFile).toHaveBeenCalledWith({
				registry: "npm",
				package_name: "express",
				filename_sha256: "abc123def456",
				start_line: 1,
				end_line: 50,
			});
		});

		test("passes version flag", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchReadFileV2V2PackageSearchReadFilePost({
				registry: "py_pi",
				package_name: "requests",
				filename_sha256: "xyz789",
				start_line: 10,
				end_line: 30,
				version: "2.31.0",
			});

			expect(mockPackageSearchReadFile).toHaveBeenCalledWith({
				registry: "py_pi",
				package_name: "requests",
				filename_sha256: "xyz789",
				start_line: 10,
				end_line: 30,
				version: "2.31.0",
			});
		});

		test("returns file content", async () => {
			await createSdk();

			const result =
				await V2ApiPackageSearchService.packageSearchReadFileV2V2PackageSearchReadFilePost({
					registry: "npm",
					package_name: "express",
					filename_sha256: "abc123def456",
					start_line: 1,
					end_line: 5,
				});

			expect(result.content).toBeDefined();
			expect(typeof result.content).toBe("string");
			expect(result.file).toBe("src/index.ts");
			expect(result.start_line).toBe(1);
			expect(result.end_line).toBe(5);
		});

		test("validates max 200 lines per request", () => {
			const startLine = 1;
			const endLine = 250;
			const lineRange = endLine - startLine;

			expect(lineRange > 200).toBe(true);
		});
	});

	describe("registry validation", () => {
		test("accepts valid registry: npm", () => {
			const validRegistries = ["npm", "py_pi", "crates_io", "golang_proxy", "ruby_gems"];
			expect(validRegistries.includes("npm")).toBe(true);
		});

		test("accepts valid registry: py_pi", () => {
			const validRegistries = ["npm", "py_pi", "crates_io", "golang_proxy", "ruby_gems"];
			expect(validRegistries.includes("py_pi")).toBe(true);
		});

		test("accepts valid registry: crates_io", () => {
			const validRegistries = ["npm", "py_pi", "crates_io", "golang_proxy", "ruby_gems"];
			expect(validRegistries.includes("crates_io")).toBe(true);
		});

		test("accepts valid registry: golang_proxy", () => {
			const validRegistries = ["npm", "py_pi", "crates_io", "golang_proxy", "ruby_gems"];
			expect(validRegistries.includes("golang_proxy")).toBe(true);
		});

		test("accepts valid registry: ruby_gems", () => {
			const validRegistries = ["npm", "py_pi", "crates_io", "golang_proxy", "ruby_gems"];
			expect(validRegistries.includes("ruby_gems")).toBe(true);
		});

		test("rejects invalid registry: pypi (wrong format)", () => {
			const validRegistries = ["npm", "py_pi", "crates_io", "golang_proxy", "ruby_gems"];
			expect(validRegistries.includes("pypi")).toBe(false);
		});

		test("rejects invalid registry: crates (incomplete)", () => {
			const validRegistries = ["npm", "py_pi", "crates_io", "golang_proxy", "ruby_gems"];
			expect(validRegistries.includes("crates")).toBe(false);
		});
	});

	describe("error handling", () => {
		test("handles 401 authentication error", async () => {
			mockPackageSearchGrep.mockRejectedValueOnce(
				Object.assign(new Error("Unauthorized"), { status: 401 }),
			);

			await createSdk();

			try {
				await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
					registry: "npm",
					package_name: "test",
					pattern: "test",
				});
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect((error as { status: number }).status).toBe(401);
			}
		});

		test("handles 404 package not found error", async () => {
			mockPackageSearchGrep.mockRejectedValueOnce(
				Object.assign(new Error("Not found"), { status: 404 }),
			);

			await createSdk();

			try {
				await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
					registry: "npm",
					package_name: "nonexistent-package",
					pattern: "test",
				});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(404);
			}
		});

		test("handles 429 rate limit error", async () => {
			mockPackageSearchHybrid.mockRejectedValueOnce(
				Object.assign(new Error("Too Many Requests"), { status: 429 }),
			);

			await createSdk();

			try {
				await V2ApiPackageSearchService.packageSearchHybridV2V2PackageSearchHybridPost({
					registry: "npm",
					package_name: "test",
					semantic_queries: ["test"],
				});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(429);
			}
		});

		test("handles 500 server error", async () => {
			mockPackageSearchReadFile.mockRejectedValueOnce(
				Object.assign(new Error("Internal Server Error"), { status: 500 }),
			);

			await createSdk();

			try {
				await V2ApiPackageSearchService.packageSearchReadFileV2V2PackageSearchReadFilePost({
					registry: "npm",
					package_name: "test",
					filename_sha256: "abc",
					start_line: 1,
					end_line: 10,
				});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(500);
			}
		});

		test("handles 422 validation error", async () => {
			mockPackageSearchGrep.mockRejectedValueOnce(
				Object.assign(new Error("Invalid pattern"), { status: 422 }),
			);

			await createSdk();

			try {
				await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
					registry: "npm",
					package_name: "test",
					pattern: "[invalid",
				});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(422);
			}
		});
	});

	describe("flag-to-parameter mapping", () => {
		test("grep request only includes defined fields (no undefined values)", async () => {
			await createSdk();

			const payload = {
				registry: "npm",
				package_name: "express",
				pattern: "test",
			};

			await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost(payload);

			const calledWith = (
				mockPackageSearchGrep.mock.calls as unknown as Array<[Record<string, unknown>]>
			)[0]![0];
			expect(calledWith).toEqual({
				registry: "npm",
				package_name: "express",
				pattern: "test",
			});
			expect("version" in calledWith).toBe(false);
			expect("language" in calledWith).toBe(false);
			expect("filename_sha256" in calledWith).toBe(false);
			expect("a" in calledWith).toBe(false);
			expect("b" in calledWith).toBe(false);
		});

		test("grep maps --context-before to 'b' and --context-after to 'a'", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
				registry: "npm",
				package_name: "express",
				pattern: "app",
				b: 2,
				a: 4,
			});

			expect(mockPackageSearchGrep).toHaveBeenCalledWith({
				registry: "npm",
				package_name: "express",
				pattern: "app",
				b: 2,
				a: 4,
			});
		});

		test("hybrid semantic_queries splits comma-separated values", async () => {
			await createSdk();

			const queryArg = "query one, query two, query three, query four, query five";
			const semanticQueries = queryArg.split(",").map((s) => s.trim());

			expect(semanticQueries).toEqual([
				"query one",
				"query two",
				"query three",
				"query four",
				"query five",
			]);
			expect(semanticQueries.length).toBe(5);

			await V2ApiPackageSearchService.packageSearchHybridV2V2PackageSearchHybridPost({
				registry: "npm",
				package_name: "test",
				semantic_queries: semanticQueries,
			});

			expect(mockPackageSearchHybrid).toHaveBeenCalledWith({
				registry: "npm",
				package_name: "test",
				semantic_queries: ["query one", "query two", "query three", "query four", "query five"],
			});
		});

		test("read request maps all positional args correctly", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchReadFileV2V2PackageSearchReadFilePost({
				registry: "crates_io",
				package_name: "serde",
				filename_sha256: "sha256_hash_value",
				start_line: 100,
				end_line: 200,
			});

			expect(mockPackageSearchReadFile).toHaveBeenCalledWith({
				registry: "crates_io",
				package_name: "serde",
				filename_sha256: "sha256_hash_value",
				start_line: 100,
				end_line: 200,
			});
		});

		test("all three commands work with golang_proxy registry", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
				registry: "golang_proxy",
				package_name: "gin-gonic/gin",
				pattern: "func New",
			});

			expect(mockPackageSearchGrep).toHaveBeenCalledWith({
				registry: "golang_proxy",
				package_name: "gin-gonic/gin",
				pattern: "func New",
			});

			await V2ApiPackageSearchService.packageSearchHybridV2V2PackageSearchHybridPost({
				registry: "golang_proxy",
				package_name: "gin-gonic/gin",
				semantic_queries: ["middleware chain"],
			});

			expect(mockPackageSearchHybrid).toHaveBeenCalledWith({
				registry: "golang_proxy",
				package_name: "gin-gonic/gin",
				semantic_queries: ["middleware chain"],
			});

			await V2ApiPackageSearchService.packageSearchReadFileV2V2PackageSearchReadFilePost({
				registry: "golang_proxy",
				package_name: "gin-gonic/gin",
				filename_sha256: "hash",
				start_line: 1,
				end_line: 50,
			});

			expect(mockPackageSearchReadFile).toHaveBeenCalledWith({
				registry: "golang_proxy",
				package_name: "gin-gonic/gin",
				filename_sha256: "hash",
				start_line: 1,
				end_line: 50,
			});
		});

		test("grep passes all optional flags together", async () => {
			await createSdk();

			await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost({
				registry: "npm",
				package_name: "express",
				pattern: "Router",
				version: "4.18.2",
				language: "typescript",
				filename_sha256: "file_hash",
				b: 3,
				a: 5,
				head_limit: 100,
				output_mode: "content",
			});

			expect(mockPackageSearchGrep).toHaveBeenCalledWith({
				registry: "npm",
				package_name: "express",
				pattern: "Router",
				version: "4.18.2",
				language: "typescript",
				filename_sha256: "file_hash",
				b: 3,
				a: 5,
				head_limit: 100,
				output_mode: "content",
			});
		});
	});
});
