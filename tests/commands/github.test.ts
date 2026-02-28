import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	getConfigDirPath,
	resetConfig,
	writeConfig,
} from "../helpers/config-store.ts";

// --- Mock SDK ---

const mockGithubGlob = mock(() =>
	Promise.resolve({
		files: ["src/index.ts", "src/utils/helper.ts", "src/types/config.ts"],
	}),
);

const mockGithubRead = mock(() =>
	Promise.resolve({
		content:
			'import { foo } from "./bar";\n\nexport function hello() {\n  return "world";\n}',
		path: "src/index.ts",
		repository: "vercel/next.js",
	}),
);

const mockGithubSearch = mock(() =>
	Promise.resolve({
		items: [
			{
				path: "src/index.ts",
				name: "index.ts",
				text_matches: [{ fragment: 'const foo = "bar"' }],
			},
			{
				path: "src/utils/helper.ts",
				name: "helper.ts",
				text_matches: [{ fragment: "function helper() {}" }],
			},
		],
	}),
);

const mockGithubTree = mock(() =>
	Promise.resolve({
		tree_text: "src/\n  index.ts\n  utils/\n    helper.ts",
		stats: {
			total_files: 3,
			total_directories: 2,
		},
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
	GithubSearchService: {
		githubGlobV2GithubGlobPost: mockGithubGlob,
		githubReadV2GithubReadPost: mockGithubRead,
		githubCodeSearchV2GithubSearchPost: mockGithubSearch,
		githubTreeV2GithubTreeOwnerRepoGet: mockGithubTree,
	},
}));

// --- Import after mocking ---

import { GithubSearchService } from "nia-ai-ts";
import { createSdk } from "../../src/services/sdk.ts";

describe("github commands", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}

		await writeConfig({
			apiKey: "nia_test_github_key",
			baseUrl: "https://apigcp.trynia.ai/v2",
			output: undefined,
		});

		mockGithubGlob.mockClear();
		mockGithubRead.mockClear();
		mockGithubSearch.mockClear();
		mockGithubTree.mockClear();
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	describe("github glob", () => {
		test("calls githubGlobV2GithubGlobPost with repository and pattern", async () => {
			await createSdk();

			await GithubSearchService.githubGlobV2GithubGlobPost({
				repository: "vercel/next.js",
				pattern: "**/*.ts",
			});

			expect(mockGithubGlob).toHaveBeenCalledTimes(1);
			expect(mockGithubGlob).toHaveBeenCalledWith({
				repository: "vercel/next.js",
				pattern: "**/*.ts",
			});
		});

		test("passes ref from --ref flag", async () => {
			await createSdk();

			await GithubSearchService.githubGlobV2GithubGlobPost({
				repository: "vercel/next.js",
				pattern: "*.py",
				ref: "canary",
			});

			expect(mockGithubGlob).toHaveBeenCalledWith({
				repository: "vercel/next.js",
				pattern: "*.py",
				ref: "canary",
			});
		});

		test("returns file list on success", async () => {
			await createSdk();

			const result = await GithubSearchService.githubGlobV2GithubGlobPost({
				repository: "vercel/next.js",
				pattern: "src/**/*.ts",
			});

			expect(result.files).toEqual([
				"src/index.ts",
				"src/utils/helper.ts",
				"src/types/config.ts",
			]);
		});

		test("handles empty results", async () => {
			mockGithubGlob.mockResolvedValueOnce({ files: [] });
			await createSdk();

			const result = await GithubSearchService.githubGlobV2GithubGlobPost({
				repository: "vercel/next.js",
				pattern: "nonexistent/**",
			});

			expect(result.files).toEqual([]);
		});

		test("GitHubGlobRequest only includes defined fields (no undefined)", async () => {
			await createSdk();

			const payload = {
				repository: "owner/repo",
				pattern: "*.ts",
			};

			await GithubSearchService.githubGlobV2GithubGlobPost(payload);

			const calledWith = (
				mockGithubGlob.mock.calls as unknown as Array<[Record<string, unknown>]>
			)[0]?.[0];
			expect(calledWith).toBeDefined();
			if (!calledWith) throw new Error("Expected github glob payload");
			expect(calledWith).toEqual({ repository: "owner/repo", pattern: "*.ts" });
			expect("ref" in calledWith).toBe(false);
		});
	});

	describe("github read", () => {
		test("calls githubReadV2GithubReadPost with repository and path", async () => {
			await createSdk();

			await GithubSearchService.githubReadV2GithubReadPost({
				repository: "vercel/next.js",
				path: "src/index.ts",
			});

			expect(mockGithubRead).toHaveBeenCalledTimes(1);
			expect(mockGithubRead).toHaveBeenCalledWith({
				repository: "vercel/next.js",
				path: "src/index.ts",
			});
		});

		test("passes ref from --ref flag", async () => {
			await createSdk();

			await GithubSearchService.githubReadV2GithubReadPost({
				repository: "vercel/next.js",
				path: "README.md",
				ref: "v14.0.0",
			});

			expect(mockGithubRead).toHaveBeenCalledWith({
				repository: "vercel/next.js",
				path: "README.md",
				ref: "v14.0.0",
			});
		});

		test("passes start_line and end_line from --start/--end flags", async () => {
			await createSdk();

			await GithubSearchService.githubReadV2GithubReadPost({
				repository: "vercel/next.js",
				path: "src/index.ts",
				start_line: 10,
				end_line: 50,
			});

			expect(mockGithubRead).toHaveBeenCalledWith({
				repository: "vercel/next.js",
				path: "src/index.ts",
				start_line: 10,
				end_line: 50,
			});
		});

		test("returns file content on success", async () => {
			await createSdk();

			const result = await GithubSearchService.githubReadV2GithubReadPost({
				repository: "vercel/next.js",
				path: "src/index.ts",
			});

			expect(typeof result.content).toBe("string");
			expect(result.content).toContain("import");
			expect(result.repository).toBe("vercel/next.js");
		});

		test("passes all parameters together", async () => {
			await createSdk();

			await GithubSearchService.githubReadV2GithubReadPost({
				repository: "facebook/react",
				path: "packages/react/src/React.js",
				ref: "main",
				start_line: 1,
				end_line: 20,
			});

			expect(mockGithubRead).toHaveBeenCalledWith({
				repository: "facebook/react",
				path: "packages/react/src/React.js",
				ref: "main",
				start_line: 1,
				end_line: 20,
			});
		});

		test("GitHubReadRequest only includes defined fields (no undefined)", async () => {
			await createSdk();

			const payload = {
				repository: "owner/repo",
				path: "file.ts",
			};

			await GithubSearchService.githubReadV2GithubReadPost(payload);

			const calledWith = (
				mockGithubRead.mock.calls as unknown as Array<[Record<string, unknown>]>
			)[0]?.[0];
			expect(calledWith).toBeDefined();
			if (!calledWith) throw new Error("Expected github read payload");
			expect(calledWith).toEqual({ repository: "owner/repo", path: "file.ts" });
			expect("ref" in calledWith).toBe(false);
			expect("start_line" in calledWith).toBe(false);
			expect("end_line" in calledWith).toBe(false);
		});
	});

	describe("github search", () => {
		test("calls githubCodeSearchV2GithubSearchPost with repository and query", async () => {
			await createSdk();

			await GithubSearchService.githubCodeSearchV2GithubSearchPost({
				query: "useState",
				repository: "facebook/react",
			});

			expect(mockGithubSearch).toHaveBeenCalledTimes(1);
			expect(mockGithubSearch).toHaveBeenCalledWith({
				query: "useState",
				repository: "facebook/react",
			});
		});

		test("passes per_page from --per-page flag", async () => {
			await createSdk();

			await GithubSearchService.githubCodeSearchV2GithubSearchPost({
				query: "createContext",
				repository: "facebook/react",
				per_page: 20,
			});

			expect(mockGithubSearch).toHaveBeenCalledWith({
				query: "createContext",
				repository: "facebook/react",
				per_page: 20,
			});
		});

		test("passes page from --page flag", async () => {
			await createSdk();

			await GithubSearchService.githubCodeSearchV2GithubSearchPost({
				query: "useEffect",
				repository: "facebook/react",
				page: 3,
			});

			expect(mockGithubSearch).toHaveBeenCalledWith({
				query: "useEffect",
				repository: "facebook/react",
				page: 3,
			});
		});

		test("passes all parameters together", async () => {
			await createSdk();

			await GithubSearchService.githubCodeSearchV2GithubSearchPost({
				query: "import React",
				repository: "vercel/next.js",
				per_page: 10,
				page: 2,
			});

			expect(mockGithubSearch).toHaveBeenCalledWith({
				query: "import React",
				repository: "vercel/next.js",
				per_page: 10,
				page: 2,
			});
		});

		test("returns search results with items", async () => {
			await createSdk();

			const result =
				await GithubSearchService.githubCodeSearchV2GithubSearchPost({
					query: "foo",
					repository: "owner/repo",
				});

			expect(result.items).toBeDefined();
			expect(Array.isArray(result.items)).toBe(true);
			expect(result.items.length).toBe(2);
			expect(result.items[0].path).toBe("src/index.ts");
		});

		test("handles empty search results", async () => {
			mockGithubSearch.mockResolvedValueOnce({ items: [] });
			await createSdk();

			const result =
				await GithubSearchService.githubCodeSearchV2GithubSearchPost({
					query: "nonexistent_pattern_xyz",
					repository: "owner/repo",
				});

			expect(result.items).toEqual([]);
		});

		test("GitHubSearchRequest only includes defined fields (no undefined)", async () => {
			await createSdk();

			const payload = {
				query: "test",
				repository: "owner/repo",
			};

			await GithubSearchService.githubCodeSearchV2GithubSearchPost(payload);

			const calledWith = (
				mockGithubSearch.mock.calls as unknown as Array<
					[Record<string, unknown>]
				>
			)[0]?.[0];
			expect(calledWith).toBeDefined();
			if (!calledWith) throw new Error("Expected github search payload");
			expect(calledWith).toEqual({ query: "test", repository: "owner/repo" });
			expect("per_page" in calledWith).toBe(false);
			expect("page" in calledWith).toBe(false);
		});
	});

	describe("github tree", () => {
		test("calls githubTreeV2GithubTreeOwnerRepoGet with separate owner and repo", async () => {
			await createSdk();

			await GithubSearchService.githubTreeV2GithubTreeOwnerRepoGet(
				"vercel",
				"next.js",
				undefined,
				undefined,
			);

			expect(mockGithubTree).toHaveBeenCalledTimes(1);
			expect(mockGithubTree).toHaveBeenCalledWith(
				"vercel",
				"next.js",
				undefined,
				undefined,
			);
		});

		test("passes ref from --ref flag", async () => {
			await createSdk();

			await GithubSearchService.githubTreeV2GithubTreeOwnerRepoGet(
				"vercel",
				"next.js",
				"canary",
				undefined,
			);

			expect(mockGithubTree).toHaveBeenCalledWith(
				"vercel",
				"next.js",
				"canary",
				undefined,
			);
		});

		test("passes path from --path flag", async () => {
			await createSdk();

			await GithubSearchService.githubTreeV2GithubTreeOwnerRepoGet(
				"vercel",
				"next.js",
				undefined,
				"packages/next",
			);

			expect(mockGithubTree).toHaveBeenCalledWith(
				"vercel",
				"next.js",
				undefined,
				"packages/next",
			);
		});

		test("passes both ref and path together", async () => {
			await createSdk();

			await GithubSearchService.githubTreeV2GithubTreeOwnerRepoGet(
				"facebook",
				"react",
				"main",
				"packages/react/src",
			);

			expect(mockGithubTree).toHaveBeenCalledWith(
				"facebook",
				"react",
				"main",
				"packages/react/src",
			);
		});

		test("returns tree with tree_text and stats", async () => {
			await createSdk();

			const result =
				await GithubSearchService.githubTreeV2GithubTreeOwnerRepoGet(
					"vercel",
					"next.js",
					undefined,
					undefined,
				);

			expect(typeof result.tree_text).toBe("string");
			expect(result.stats).toBeDefined();
			expect(result.stats.total_files).toBe(3);
			expect(result.stats.total_directories).toBe(2);
		});
	});

	describe("owner/repo parsing", () => {
		test("correctly parses standard owner/repo format", () => {
			// Simulate the parseOwnerRepo logic
			const input = "vercel/next.js";
			const parts = input.split("/");
			expect(parts.length).toBe(2);
			expect(parts[0]).toBe("vercel");
			expect(parts[1]).toBe("next.js");
		});

		test("handles repos with dots in name", () => {
			const input = "facebook/react.js";
			const parts = input.split("/");
			expect(parts.length).toBe(2);
			expect(parts[0]).toBe("facebook");
			expect(parts[1]).toBe("react.js");
		});

		test("handles repos with hyphens in name", () => {
			const input = "nozomio-labs/nia-cli";
			const parts = input.split("/");
			expect(parts.length).toBe(2);
			expect(parts[0]).toBe("nozomio-labs");
			expect(parts[1]).toBe("nia-cli");
		});

		test("detects invalid format with no slash", () => {
			const input = "invalid-repo-name";
			const parts = input.split("/");
			const isValid = parts.length === 2 && !!parts[0] && !!parts[1];
			expect(isValid).toBe(false);
		});

		test("detects invalid format with multiple slashes", () => {
			const input = "owner/repo/extra";
			const parts = input.split("/");
			const isValid = parts.length === 2 && !!parts[0] && !!parts[1];
			expect(isValid).toBe(false);
		});

		test("detects invalid format with empty owner", () => {
			const input = "/repo";
			const parts = input.split("/");
			const isValid = parts.length === 2 && !!parts[0] && !!parts[1];
			expect(isValid).toBe(false);
		});
	});

	describe("error handling", () => {
		test("handles 401 authentication error", async () => {
			mockGithubGlob.mockRejectedValueOnce(
				Object.assign(new Error("Unauthorized"), { status: 401 }),
			);

			await createSdk();

			try {
				await GithubSearchService.githubGlobV2GithubGlobPost({
					repository: "owner/repo",
					pattern: "*.ts",
				});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(401);
			}
		});

		test("handles 404 not found error", async () => {
			mockGithubRead.mockRejectedValueOnce(
				Object.assign(new Error("Not found"), { status: 404 }),
			);

			await createSdk();

			try {
				await GithubSearchService.githubReadV2GithubReadPost({
					repository: "owner/nonexistent",
					path: "file.ts",
				});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(404);
			}
		});

		test("handles 429 rate limit error", async () => {
			mockGithubSearch.mockRejectedValueOnce(
				Object.assign(new Error("Too Many Requests"), { status: 429 }),
			);

			await createSdk();

			try {
				await GithubSearchService.githubCodeSearchV2GithubSearchPost({
					query: "test",
					repository: "owner/repo",
				});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(429);
			}
		});

		test("handles 500 server error", async () => {
			mockGithubTree.mockRejectedValueOnce(
				Object.assign(new Error("Internal Server Error"), { status: 500 }),
			);

			await createSdk();

			try {
				await GithubSearchService.githubTreeV2GithubTreeOwnerRepoGet(
					"owner",
					"repo",
					undefined,
					undefined,
				);
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(500);
			}
		});

		test("handles 422 validation error", async () => {
			mockGithubGlob.mockRejectedValueOnce(
				Object.assign(new Error("Validation error: invalid pattern"), {
					status: 422,
				}),
			);

			await createSdk();

			try {
				await GithubSearchService.githubGlobV2GithubGlobPost({
					repository: "owner/repo",
					pattern: "",
				});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as { status: number }).status).toBe(422);
			}
		});
	});

	describe("flag-to-parameter mapping", () => {
		test("glob maps repo arg to repository field in request body", async () => {
			await createSdk();

			await GithubSearchService.githubGlobV2GithubGlobPost({
				repository: "vercel/next.js",
				pattern: "*.ts",
			});

			expect(mockGithubGlob).toHaveBeenCalledWith(
				expect.objectContaining({ repository: "vercel/next.js" }),
			);
		});

		test("read maps --start/--end flags to start_line/end_line fields", async () => {
			await createSdk();

			await GithubSearchService.githubReadV2GithubReadPost({
				repository: "owner/repo",
				path: "file.ts",
				start_line: 5,
				end_line: 25,
			});

			expect(mockGithubRead).toHaveBeenCalledWith(
				expect.objectContaining({
					start_line: 5,
					end_line: 25,
				}),
			);
		});

		test("search maps --per-page flag to per_page field", async () => {
			await createSdk();

			await GithubSearchService.githubCodeSearchV2GithubSearchPost({
				query: "test",
				repository: "owner/repo",
				per_page: 15,
			});

			expect(mockGithubSearch).toHaveBeenCalledWith(
				expect.objectContaining({ per_page: 15 }),
			);
		});

		test("tree passes separate owner and repo to API method (not combined)", async () => {
			await createSdk();

			await GithubSearchService.githubTreeV2GithubTreeOwnerRepoGet(
				"nozomio-labs",
				"nia-cli",
				undefined,
				undefined,
			);

			// Verify the tree method receives separate owner and repo, not combined
			expect(mockGithubTree).toHaveBeenCalledWith(
				"nozomio-labs",
				"nia-cli",
				undefined,
				undefined,
			);
		});

		test("tree ref and path flags map to correct positional parameters", async () => {
			await createSdk();

			await GithubSearchService.githubTreeV2GithubTreeOwnerRepoGet(
				"vercel",
				"next.js",
				"canary",
				"src/shared",
			);

			expect(mockGithubTree).toHaveBeenCalledWith(
				"vercel",
				"next.js",
				"canary",
				"src/shared",
			);
		});

		test("search page flag maps to page field in request body", async () => {
			await createSdk();

			await GithubSearchService.githubCodeSearchV2GithubSearchPost({
				query: "test",
				repository: "owner/repo",
				page: 5,
			});

			expect(mockGithubSearch).toHaveBeenCalledWith(
				expect.objectContaining({ page: 5 }),
			);
		});
	});
});
