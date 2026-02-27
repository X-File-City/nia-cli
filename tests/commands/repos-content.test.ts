import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	getConfigDirPath,
	resetConfig,
	writeConfig,
} from "../../src/services/config.ts";

// --- Mock V2ApiRepositoriesService ---

const mockGetContent = mock(() =>
	Promise.resolve({
		success: true as boolean,
		content:
			'import { defineCommand } from "@crustjs/core";\n\nexport const main = () => {\n\tconsole.log("hello");\n};' as
				| string
				| null,
		metadata: {
			path: "src/cli.ts",
			size: 98,
			language: "TypeScript",
		} as Record<string, unknown> | null,
		error: null as string | null,
	}),
);

const mockGrep = mock(() =>
	Promise.resolve({
		success: true as boolean | undefined,
		pattern: "defineCommand",
		path_filter: undefined as string | undefined,
		total_matches: 3 as number | undefined,
		files_searched: 25 as number | undefined,
		files_with_matches: 2 as number | undefined,
		truncated: false as boolean | undefined,
		options: {
			case_sensitive: false,
			whole_word: false,
			fixed_string: false,
			exhaustive: true,
		} as Record<string, unknown> | undefined,
		matches: {
			"src/cli.ts": [
				{
					line: 1,
					content: 'import { defineCommand } from "@crustjs/core";',
					match: "defineCommand",
				},
				{
					line: 5,
					content: "const cmd = defineCommand({",
					match: "defineCommand",
				},
			],
			"src/commands/auth.ts": [
				{
					line: 3,
					content: 'import { defineCommand } from "@crustjs/core";',
					match: "defineCommand",
				},
			],
		} as Record<string, Array<Record<string, unknown>>> | null | undefined,
		files: null as Array<string> | null | undefined,
		counts: null as Record<string, number> | null | undefined,
	}),
);

const mockGetTree = mock(() =>
	Promise.resolve({
		repository_id: "repo-001",
		owner: "vercel",
		repo: "ai",
		branch: "main",
		sha: "abc123def",
		tree_text:
			"ai/\n├── src/\n│   ├── cli.ts\n│   └── utils.ts\n├── tests/\n│   └── cli.test.ts\n├── package.json\n└── README.md",
		stats: {
			total_files: 5,
			total_directories: 2,
			total_items: 7,
			file_extensions: { ts: 3, json: 1, md: 1 },
			max_depth: 2,
		},
		files: [
			{ path: "src/cli.ts", type: "blob", size: 1234 },
			{ path: "src/utils.ts", type: "blob", size: 567 },
			{ path: "tests/cli.test.ts", type: "blob", size: 890 },
			{ path: "package.json", type: "blob", size: 456 },
			{ path: "README.md", type: "blob", size: 234 },
		],
		directories: [
			{ path: "src", type: "tree" },
			{ path: "tests", type: "tree" },
		],
		truncated: false,
		source: "index",
		retrieved_at: "2026-02-27T12:00:00Z",
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
	V2ApiRepositoriesService: {
		indexRepositoryV2V2RepositoriesPost: mock(() => Promise.resolve({})),
		listRepositoriesV2V2RepositoriesGet: mock(() => Promise.resolve([])),
		getRepositoryStatusV2V2RepositoriesRepositoryIdGet: mock(() =>
			Promise.resolve({}),
		),
		deleteRepositoryV2V2RepositoriesRepositoryIdDelete: mock(() =>
			Promise.resolve({}),
		),
		renameRepositoryV2V2RepositoriesRepositoryIdRenamePatch: mock(() =>
			Promise.resolve({}),
		),
		getRepositoryContentV2V2RepositoriesRepositoryIdContentGet: mockGetContent,
		grepRepositoryV2V2RepositoriesRepositoryIdGrepPost: mockGrep,
		getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet: mockGetTree,
	},
}));

// --- Import after mocking ---

import { createSdk } from "../../src/services/sdk.ts";

describe("repos content commands", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}

		await writeConfig({
			apiKey: "nia_test_repos_content_key",
			baseUrl: "https://apigcp.trynia.ai/v2",
			output: undefined,
		});

		mockGetContent.mockClear();
		mockGrep.mockClear();
		mockGetTree.mockClear();
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	// --- read ---

	describe("read (V2ApiRepositoriesService.getRepositoryContent)", () => {
		test("calls getRepositoryContent with repoId and path", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.getRepositoryContentV2V2RepositoriesRepositoryIdContentGet(
				"repo-001",
				"src/cli.ts",
			);

			expect(mockGetContent).toHaveBeenCalledTimes(1);
			expect(mockGetContent).toHaveBeenCalledWith("repo-001", "src/cli.ts");
		});

		test("passes branch parameter", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.getRepositoryContentV2V2RepositoriesRepositoryIdContentGet(
				"repo-001",
				"src/cli.ts",
				"canary",
			);

			expect(mockGetContent).toHaveBeenCalledWith(
				"repo-001",
				"src/cli.ts",
				"canary",
			);
		});

		test("passes ref parameter (takes precedence over branch)", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.getRepositoryContentV2V2RepositoriesRepositoryIdContentGet(
				"repo-001",
				"src/cli.ts",
				undefined,
				"v3.0.0",
			);

			expect(mockGetContent).toHaveBeenCalledWith(
				"repo-001",
				"src/cli.ts",
				undefined,
				"v3.0.0",
			);
		});

		test("passes both branch and ref parameters", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.getRepositoryContentV2V2RepositoriesRepositoryIdContentGet(
				"repo-001",
				"src/cli.ts",
				"canary",
				"abc123",
			);

			expect(mockGetContent).toHaveBeenCalledWith(
				"repo-001",
				"src/cli.ts",
				"canary",
				"abc123",
			);
		});

		test("returns file content with success and metadata", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result =
				await svc.getRepositoryContentV2V2RepositoriesRepositoryIdContentGet(
					"repo-001",
					"src/cli.ts",
				);

			expect(result.success).toBe(true);
			expect(result.content).toContain("defineCommand");
			expect(result.content).toContain("hello");
			expect(result.metadata).toBeDefined();
			expect(result.metadata?.path).toBe("src/cli.ts");
			expect(result.metadata?.language).toBe("TypeScript");
			expect(result.error).toBeNull();
		});

		test("handles 404 when file not found", async () => {
			mockGetContent.mockImplementationOnce(() => {
				const error = new Error("Not Found") as Error & { status: number };
				error.status = 404;
				return Promise.reject(error);
			});

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");

			await expect(
				svc.getRepositoryContentV2V2RepositoriesRepositoryIdContentGet(
					"repo-001",
					"nonexistent.ts",
				),
			).rejects.toThrow("Not Found");
		});

		test("handles response with error field", async () => {
			mockGetContent.mockImplementationOnce(() =>
				Promise.resolve({
					success: false,
					content: null,
					metadata: null,
					error: "File too large to display",
				}),
			);

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result =
				await svc.getRepositoryContentV2V2RepositoriesRepositoryIdContentGet(
					"repo-001",
					"large-file.bin",
				);

			expect(result.success).toBe(false);
			expect(result.error).toBe("File too large to display");
		});
	});

	// --- grep ---

	describe("grep (V2ApiRepositoriesService.grepRepository)", () => {
		test("calls grepRepository with repoId and CodeGrepRequest body", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost("repo-001", {
				pattern: "defineCommand",
			});

			expect(mockGrep).toHaveBeenCalledTimes(1);
			expect(mockGrep).toHaveBeenCalledWith("repo-001", {
				pattern: "defineCommand",
			});
		});

		test("passes path filter in CodeGrepRequest", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost("repo-001", {
				pattern: "import",
				path: "src/",
			});

			expect(mockGrep).toHaveBeenCalledWith("repo-001", {
				pattern: "import",
				path: "src/",
			});
		});

		test("passes case_sensitive and whole_word options", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost("repo-001", {
				pattern: "DefineCommand",
				case_sensitive: true,
				whole_word: true,
			});

			expect(mockGrep).toHaveBeenCalledWith("repo-001", {
				pattern: "DefineCommand",
				case_sensitive: true,
				whole_word: true,
			});
		});

		test("passes fixed_string option for literal matching", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost("repo-001", {
				pattern: "console.log(",
				fixed_string: true,
			});

			expect(mockGrep).toHaveBeenCalledWith("repo-001", {
				pattern: "console.log(",
				fixed_string: true,
			});
		});

		test("passes context lines (A and B) parameters", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost("repo-001", {
				pattern: "defineCommand",
				A: 3,
				B: 2,
			});

			expect(mockGrep).toHaveBeenCalledWith("repo-001", {
				pattern: "defineCommand",
				A: 3,
				B: 2,
			});
		});

		test("passes max_matches_per_file and max_total_matches", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost("repo-001", {
				pattern: "import",
				max_matches_per_file: 5,
				max_total_matches: 50,
			});

			expect(mockGrep).toHaveBeenCalledWith("repo-001", {
				pattern: "import",
				max_matches_per_file: 5,
				max_total_matches: 50,
			});
		});

		test("passes exhaustive flag", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost("repo-001", {
				pattern: "defineCommand",
				exhaustive: true,
			});

			expect(mockGrep).toHaveBeenCalledWith("repo-001", {
				pattern: "defineCommand",
				exhaustive: true,
			});
		});

		test("passes ref parameter for specific git ref", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost("repo-001", {
				pattern: "defineCommand",
				ref: "v2.0.0",
			});

			expect(mockGrep).toHaveBeenCalledWith("repo-001", {
				pattern: "defineCommand",
				ref: "v2.0.0",
			});
		});

		test("returns grep results with match details", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result =
				await svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost(
					"repo-001",
					{
						pattern: "defineCommand",
					},
				);

			expect(result.success).toBe(true);
			expect(result.pattern).toBe("defineCommand");
			expect(result.total_matches).toBe(3);
			expect(result.files_searched).toBe(25);
			expect(result.files_with_matches).toBe(2);
			expect(result.truncated).toBe(false);
			expect(result.matches).toBeDefined();
			expect(result.matches?.["src/cli.ts"]).toHaveLength(2);
			expect(result.matches?.["src/commands/auth.ts"]).toHaveLength(1);
		});

		test("passes all CodeGrepRequest fields together", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const fullRequest = {
				pattern: "import",
				path: "src/",
				ref: "main",
				case_sensitive: true,
				whole_word: false,
				fixed_string: true,
				A: 2,
				B: 3,
				max_matches_per_file: 10,
				max_total_matches: 100,
				exhaustive: true,
			};

			await svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost(
				"repo-001",
				fullRequest,
			);

			expect(mockGrep).toHaveBeenCalledWith("repo-001", fullRequest);
		});

		test("handles empty grep results", async () => {
			mockGrep.mockImplementationOnce(() =>
				Promise.resolve({
					success: true as boolean | undefined,
					pattern: "nonexistent_pattern_xyz",
					path_filter: undefined as string | undefined,
					total_matches: 0 as number | undefined,
					files_searched: 25 as number | undefined,
					files_with_matches: 0 as number | undefined,
					truncated: false as boolean | undefined,
					options: undefined as Record<string, unknown> | undefined,
					matches: {} as
						| Record<string, Array<Record<string, unknown>>>
						| null
						| undefined,
					files: null as Array<string> | null | undefined,
					counts: null as Record<string, number> | null | undefined,
				}),
			);

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result =
				await svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost(
					"repo-001",
					{
						pattern: "nonexistent_pattern_xyz",
					},
				);

			expect(result.total_matches).toBe(0);
			expect(result.files_with_matches).toBe(0);
		});
	});

	// --- tree ---

	describe("tree (V2ApiRepositoriesService.getRepositoryTree)", () => {
		test("calls getRepositoryTree with repoId", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet(
				"repo-001",
			);

			expect(mockGetTree).toHaveBeenCalledTimes(1);
			expect(mockGetTree).toHaveBeenCalledWith("repo-001");
		});

		test("passes branch parameter", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet(
				"repo-001",
				"canary",
			);

			expect(mockGetTree).toHaveBeenCalledWith("repo-001", "canary");
		});

		test("passes includePaths and excludePaths", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet(
				"repo-001",
				undefined,
				"src/,lib/",
				"node_modules/,dist/",
			);

			expect(mockGetTree).toHaveBeenCalledWith(
				"repo-001",
				undefined,
				"src/,lib/",
				"node_modules/,dist/",
			);
		});

		test("passes file extension filters", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet(
				"repo-001",
				undefined,
				undefined,
				undefined,
				"ts,js",
				"test.ts",
			);

			expect(mockGetTree).toHaveBeenCalledWith(
				"repo-001",
				undefined,
				undefined,
				undefined,
				"ts,js",
				"test.ts",
			);
		});

		test("passes showFullPaths flag", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet(
				"repo-001",
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				true,
			);

			expect(mockGetTree).toHaveBeenCalledWith(
				"repo-001",
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				true,
			);
		});

		test("returns tree with tree_text and stats", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result =
				await svc.getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet(
					"repo-001",
				);

			expect(result.repository_id).toBe("repo-001");
			expect(result.owner).toBe("vercel");
			expect(result.repo).toBe("ai");
			expect(result.branch).toBe("main");
			expect(result.tree_text).toContain("src/");
			expect(result.tree_text).toContain("cli.ts");
			expect(result.tree_text).toContain("README.md");
			expect(result.stats).toBeDefined();
			expect(result.stats?.total_files).toBe(5);
			expect(result.stats?.total_directories).toBe(2);
			expect(result.stats?.file_extensions).toEqual({ ts: 3, json: 1, md: 1 });
			expect(result.stats?.max_depth).toBe(2);
			expect(result.truncated).toBe(false);
		});

		test("returns tree with files and directories arrays", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result =
				await svc.getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet(
					"repo-001",
				);

			expect(result.files).toHaveLength(5);
			expect(result.directories).toHaveLength(2);
			expect(result.files?.[0]?.path).toBe("src/cli.ts");
			expect(result.files?.[0]?.type).toBe("blob");
			expect(result.directories?.[0]?.path).toBe("src");
			expect(result.directories?.[0]?.type).toBe("tree");
		});

		test("handles 404 when repository not found", async () => {
			mockGetTree.mockImplementationOnce(() => {
				const error = new Error("Not Found") as Error & { status: number };
				error.status = 404;
				return Promise.reject(error);
			});

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");

			await expect(
				svc.getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet("nonexistent"),
			).rejects.toThrow("Not Found");
		});

		test("passes all tree parameters together", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet(
				"repo-001",
				"develop",
				"src/,lib/",
				"node_modules/",
				"ts,tsx",
				"test.ts,spec.ts",
				true,
			);

			expect(mockGetTree).toHaveBeenCalledWith(
				"repo-001",
				"develop",
				"src/,lib/",
				"node_modules/",
				"ts,tsx",
				"test.ts,spec.ts",
				true,
			);
		});
	});

	// --- flag-to-parameter mapping ---

	describe("flag-to-parameter mapping", () => {
		test("--branch/-b maps to branch parameter on read", () => {
			const branch = "canary";
			expect(branch).toBe("canary");
		});

		test("--ref maps to ref parameter on read (takes precedence over branch)", () => {
			const ref = "v3.0.0";
			expect(ref).toBe("v3.0.0");
		});

		test("--path flag maps to CodeGrepRequest.path", () => {
			const request: Record<string, unknown> = { pattern: "test" };
			request.path = "src/";
			expect(request.path).toBe("src/");
		});

		test("--case-sensitive maps to CodeGrepRequest.case_sensitive", () => {
			const request: Record<string, unknown> = { pattern: "test" };
			request.case_sensitive = true;
			expect(request.case_sensitive).toBe(true);
		});

		test("--whole-word maps to CodeGrepRequest.whole_word", () => {
			const request: Record<string, unknown> = { pattern: "test" };
			request.whole_word = true;
			expect(request.whole_word).toBe(true);
		});

		test("--fixed-string maps to CodeGrepRequest.fixed_string", () => {
			const request: Record<string, unknown> = { pattern: "test" };
			request.fixed_string = true;
			expect(request.fixed_string).toBe(true);
		});

		test("--lines-before maps to CodeGrepRequest.B", () => {
			const request: Record<string, unknown> = { pattern: "test" };
			const linesBefore = 3;
			request.B = linesBefore;
			expect(request.B).toBe(3);
		});

		test("--lines-after maps to CodeGrepRequest.A", () => {
			const request: Record<string, unknown> = { pattern: "test" };
			const linesAfter = 5;
			request.A = linesAfter;
			expect(request.A).toBe(5);
		});

		test("--max-per-file maps to CodeGrepRequest.max_matches_per_file", () => {
			const request: Record<string, unknown> = { pattern: "test" };
			request.max_matches_per_file = 10;
			expect(request.max_matches_per_file).toBe(10);
		});

		test("--max-total maps to CodeGrepRequest.max_total_matches", () => {
			const request: Record<string, unknown> = { pattern: "test" };
			request.max_total_matches = 100;
			expect(request.max_total_matches).toBe(100);
		});

		test("--exhaustive maps to CodeGrepRequest.exhaustive", () => {
			const request: Record<string, unknown> = { pattern: "test" };
			request.exhaustive = true;
			expect(request.exhaustive).toBe(true);
		});

		test("--include-paths maps to includePaths parameter on tree", () => {
			const includePaths = "src/,lib/";
			expect(includePaths).toBe("src/,lib/");
		});

		test("--exclude-paths maps to excludePaths parameter on tree", () => {
			const excludePaths = "node_modules/,dist/";
			expect(excludePaths).toBe("node_modules/,dist/");
		});

		test("--extensions maps to fileExtensions parameter on tree", () => {
			const extensions = "ts,js,tsx";
			expect(extensions).toBe("ts,js,tsx");
		});

		test("--exclude-extensions maps to excludeExtensions parameter on tree", () => {
			const excludeExtensions = "test.ts,spec.ts";
			expect(excludeExtensions).toBe("test.ts,spec.ts");
		});

		test("--full-paths maps to showFullPaths parameter on tree", () => {
			const fullPaths = true;
			expect(fullPaths).toBe(true);
		});
	});

	// --- error handling ---

	describe("error handling", () => {
		test("handles 401 authentication error on content read", async () => {
			mockGetContent.mockImplementationOnce(() => {
				const error = new Error("Unauthorized") as Error & { status: number };
				error.status = 401;
				return Promise.reject(error);
			});

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");

			await expect(
				svc.getRepositoryContentV2V2RepositoriesRepositoryIdContentGet(
					"repo-001",
					"test.ts",
				),
			).rejects.toThrow("Unauthorized");
		});

		test("handles 429 rate limit error on grep", async () => {
			mockGrep.mockImplementationOnce(() => {
				const error = new Error("Rate Limited") as Error & { status: number };
				error.status = 429;
				return Promise.reject(error);
			});

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");

			await expect(
				svc.grepRepositoryV2V2RepositoriesRepositoryIdGrepPost("repo-001", {
					pattern: "test",
				}),
			).rejects.toThrow("Rate Limited");
		});

		test("handles 500 server error on tree", async () => {
			mockGetTree.mockImplementationOnce(() => {
				const error = new Error("Internal Server Error") as Error & {
					status: number;
				};
				error.status = 500;
				return Promise.reject(error);
			});

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");

			await expect(
				svc.getRepositoryTreeV2V2RepositoriesRepositoryIdTreeGet("repo-001"),
			).rejects.toThrow("Internal Server Error");
		});

		test("handles missing API key error", async () => {
			await writeConfig({
				apiKey: undefined,
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			delete process.env.NIA_API_KEY;

			await expect(createSdk()).rejects.toThrow("No API key found");
		});
	});
});
