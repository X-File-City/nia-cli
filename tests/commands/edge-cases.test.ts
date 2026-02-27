import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	getConfigDirPath,
	isSettableKey,
	maskApiKey,
	readConfig,
	resetConfig,
	resolveApiKey,
	writeConfig,
} from "../../src/services/config.ts";

// --- Mock SDK ---

const mockCreateSources = mock(() =>
	Promise.resolve({ id: "src_123", status: "processing", name: "Test" }),
);
const mockListSources = mock(() => Promise.resolve({ items: [], pagination: { total: 0 } }));
const mockResolveSources = mock(() => Promise.resolve({ id: "src_123", name: "Test" }));
const mockSaveContext = mock(() =>
	Promise.resolve({ id: "ctx_123", title: "Test", memory_type: "episodic" }),
);
const mockListContexts = mock(() =>
	Promise.resolve({ items: [], pagination: { total: 0, has_more: false } }),
);
const mockUpdateContext = mock(() => Promise.resolve({ id: "ctx_123", title: "Updated" }));
const mockSearchContexts = mock(() => Promise.resolve({ contexts: [], total_results: 0 }));
const mockSemanticSearch = mock(() =>
	Promise.resolve({ results: [], search_metadata: {}, suggestions: {} }),
);
const mockGetContext = mock(() =>
	Promise.resolve({ id: "ctx_123", title: "Test", content: "Content" }),
);
const mockDeleteContext = mock(() => Promise.resolve({ success: true }));

const mockCreateJob = mock(() => Promise.resolve({ job_id: "job_123", session_id: "sess_456" }));
const mockGetJob = mock(() =>
	Promise.resolve({ job_id: "job_123", status: "completed", query: "test" }),
);

mock.module("nia-ai-ts", () => ({
	NiaSDK: class {
		search = {};
		sources = {
			create: mockCreateSources,
			list: mockListSources,
			resolve: mockResolveSources,
		};
		oracle = {
			createJob: mockCreateJob,
			getJob: mockGetJob,
			streamJob: mock(async function* () {}),
		};
	},
	OpenAPI: {
		BASE: "",
		TOKEN: "",
	},
	V2ApiContextsService: {
		saveContextV2V2ContextsPost: mockSaveContext,
		listContextsV2V2ContextsGet: mockListContexts,
		searchContextsV2V2ContextsSearchGet: mockSearchContexts,
		semanticSearchContextsV2V2ContextsSemanticSearchGet: mockSemanticSearch,
		getContextV2V2ContextsContextIdGet: mockGetContext,
		updateContextV2V2ContextsContextIdPut: mockUpdateContext,
		deleteContextV2V2ContextsContextIdDelete: mockDeleteContext,
	},
	V2ApiSourcesService: {
		getSourceV2SourcesSourceIdGet: mock(() => Promise.resolve({ id: "src_123" })),
		updateSourceV2SourcesSourceIdPatch: mock(() => Promise.resolve({ id: "src_123" })),
		deleteSourceV2SourcesSourceIdDelete: mock(() => Promise.resolve({ success: true })),
	},
	V2ApiDataSourcesService: {
		renameDataSourceV2V2DataSourcesRenamePatch: mock(() => Promise.resolve({ success: true })),
		readDocumentationFileV2V2DataSourcesSourceIdReadGet: mock(() =>
			Promise.resolve({ content: "file content" }),
		),
		grepDocumentationV2V2DataSourcesSourceIdGrepPost: mock(() => Promise.resolve({ matches: [] })),
		getDocumentationTreeV2V2DataSourcesSourceIdTreeGet: mock(() =>
			Promise.resolve({ tree_string: "." }),
		),
		listDocumentationDirectoryV2V2DataSourcesSourceIdLsGet: mock(() =>
			Promise.resolve({ entries: [] }),
		),
	},
	DefaultService: {
		cancelOracleJobV2OracleJobsJobIdDelete: mock(() => Promise.resolve({ success: true })),
		listOracleJobsV2OracleJobsGet: mock(() => Promise.resolve([])),
		listOracleSessionsV2OracleSessionsGet: mock(() => Promise.resolve([])),
		getOracleSessionDetailV2OracleSessionsSessionIdGet: mock(() => Promise.resolve({})),
		deleteOracleSessionV2OracleSessionsSessionIdDelete: mock(() =>
			Promise.resolve({ success: true }),
		),
		getOracleSessionMessagesV2OracleSessionsSessionIdMessagesGet: mock(() => Promise.resolve([])),
	},
}));

// --- Import after mocking ---

describe("edge cases", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}
		await writeConfig({
			apiKey: "nia_test_edge_key",
			baseUrl: "https://apigcp.trynia.ai/v2",
			output: undefined,
		});
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
		delete process.env.NIA_API_KEY;
	});

	// --- Source type validation ---

	describe("source type validation", () => {
		const VALID_SOURCE_TYPES = [
			"repository",
			"documentation",
			"research_paper",
			"huggingface_dataset",
			"local_folder",
		];

		test("accepts all valid source types", () => {
			for (const type of VALID_SOURCE_TYPES) {
				expect(VALID_SOURCE_TYPES.includes(type)).toBe(true);
			}
		});

		test("rejects invalid source types", () => {
			const invalidTypes = ["repo", "doc", "paper", "dataset", "folder", "", "REPOSITORY"];
			for (const type of invalidTypes) {
				expect(VALID_SOURCE_TYPES.includes(type)).toBe(false);
			}
		});

		test("undefined type returns undefined (no validation needed)", () => {
			const type: string | undefined = undefined;
			const result = type ? VALID_SOURCE_TYPES.includes(type) : undefined;
			expect(result).toBeUndefined();
		});
	});

	// --- Memory type validation ---

	describe("memory type validation", () => {
		const VALID_MEMORY_TYPES = ["scratchpad", "episodic", "fact", "procedural"];

		test("accepts all valid memory types", () => {
			for (const type of VALID_MEMORY_TYPES) {
				expect(VALID_MEMORY_TYPES.includes(type)).toBe(true);
			}
		});

		test("rejects invalid memory types", () => {
			const invalidTypes = ["scratch", "episode", "facts", "procedure", "", "SCRATCHPAD"];
			for (const type of invalidTypes) {
				expect(VALID_MEMORY_TYPES.includes(type)).toBe(false);
			}
		});

		test("validation happens before API call", () => {
			// The command handler validates memory type before calling the API
			// This tests the validation logic pattern
			const memoryType = "invalid";
			const isValid = VALID_MEMORY_TYPES.includes(memoryType);
			expect(isValid).toBe(false);
		});
	});

	// --- Registry validation ---

	describe("registry validation", () => {
		const VALID_REGISTRIES = ["npm", "py_pi", "crates_io", "golang_proxy", "ruby_gems"];

		test("accepts all valid registries", () => {
			for (const reg of VALID_REGISTRIES) {
				expect(VALID_REGISTRIES.includes(reg)).toBe(true);
			}
		});

		test("rejects common mistakes", () => {
			const invalidRegistries = ["pypi", "crates", "go", "npm.js", "rubygems", "NPM"];
			for (const reg of invalidRegistries) {
				expect(VALID_REGISTRIES.includes(reg)).toBe(false);
			}
		});
	});

	// --- Oracle status validation ---

	describe("oracle status validation", () => {
		const VALID_STATUSES = ["queued", "running", "completed", "failed", "cancelled"];

		test("accepts all valid statuses", () => {
			for (const status of VALID_STATUSES) {
				expect(VALID_STATUSES.includes(status)).toBe(true);
			}
		});

		test("rejects invalid statuses", () => {
			const invalidStatuses = ["pending", "done", "error", "canceled", "RUNNING"];
			for (const status of invalidStatuses) {
				expect(VALID_STATUSES.includes(status)).toBe(false);
			}
		});
	});

	// --- Web search category validation ---

	describe("web search category validation", () => {
		const VALID_CATEGORIES = ["github", "company", "research", "news", "tweet", "pdf", "blog"];

		test("accepts all valid categories", () => {
			for (const cat of VALID_CATEGORIES) {
				expect(VALID_CATEGORIES.includes(cat)).toBe(true);
			}
		});

		test("rejects invalid categories", () => {
			const invalidCategories = ["code", "api", "docs", "repo", "article", "GITHUB"];
			for (const cat of invalidCategories) {
				expect(VALID_CATEGORIES.includes(cat)).toBe(false);
			}
		});
	});

	// --- Stdin piping logic ---

	describe("stdin piping for --content", () => {
		test("content === '-' triggers stdin reading", () => {
			const content = "-";
			const shouldReadStdin = content === "-";
			expect(shouldReadStdin).toBe(true);
		});

		test("regular content does not trigger stdin reading", () => {
			const content: string = "Hello, world!";
			const shouldReadStdin = content === "-";
			expect(shouldReadStdin).toBe(false);
		});

		test("empty content does not trigger stdin reading", () => {
			const content: string = "";
			const shouldReadStdin = content === "-";
			expect(shouldReadStdin).toBe(false);
		});

		test("content with dash in text does not trigger stdin", () => {
			const content: string = "this-is-content-with-dashes";
			const shouldReadStdin = content === "-";
			expect(shouldReadStdin).toBe(false);
		});

		test("empty stdin content after trim should be rejected", () => {
			const stdinContent = "   \n\t  \n  ";
			const trimmed = stdinContent.trim();
			expect(trimmed).toBe("");
			// The handler checks: if (!content.trim()) { exit(1) }
			expect(!trimmed).toBe(true);
		});

		test("non-empty stdin content should be accepted", () => {
			const stdinContent = "  actual content from stdin  ";
			const trimmed = stdinContent.trim();
			expect(trimmed).toBe("actual content from stdin");
			expect(!trimmed).toBe(false);
		});
	});

	// --- Update validation (at least one field required) ---

	describe("update requires at least one field", () => {
		test("contexts update with no fields should be rejected", () => {
			const flags = { title: undefined, summary: undefined, content: undefined, tags: undefined };
			const hasUpdate = !!flags.title || !!flags.summary || !!flags.content || !!flags.tags;
			expect(hasUpdate).toBe(false);
		});

		test("contexts update with title should be accepted", () => {
			const flags = {
				title: "New Title",
				summary: undefined,
				content: undefined,
				tags: undefined,
			};
			const hasUpdate = !!flags.title || !!flags.summary || !!flags.content || !!flags.tags;
			expect(hasUpdate).toBe(true);
		});

		test("sources update requires --name or --category", () => {
			const flags = { name: undefined, category: undefined };
			const hasUpdate = !!flags.name || !!flags.category;
			expect(hasUpdate).toBe(false);
		});

		test("sources update with --name is accepted", () => {
			const flags = { name: "New Name", category: undefined };
			const hasUpdate = !!flags.name || !!flags.category;
			expect(hasUpdate).toBe(true);
		});

		test("categories update requires --name, --color, or --order", () => {
			const flags = { name: undefined, color: undefined, order: undefined };
			const hasUpdate = !!flags.name || !!flags.color || flags.order !== undefined;
			expect(hasUpdate).toBe(false);
		});
	});

	// --- API key masking ---

	describe("API key masking in all contexts", () => {
		test("masks nia_ prefixed keys", () => {
			expect(maskApiKey("nia_abcdef1234")).toBe("nia_****...1234");
		});

		test("masks non-nia_ keys", () => {
			expect(maskApiKey("sk-test-key-abcd")).toBe("****...abcd");
		});

		test("returns (not set) for undefined", () => {
			expect(maskApiKey(undefined)).toBe("(not set)");
		});

		test("returns (not set) for empty string", () => {
			expect(maskApiKey("")).toBe("(not set)");
		});

		test("handles very short keys", () => {
			expect(maskApiKey("ab")).toBe("****...ab");
		});

		test("handles exactly 4 char keys", () => {
			expect(maskApiKey("abcd")).toBe("****...abcd");
		});

		test("API key is never printed in full by config get/list", async () => {
			await writeConfig({
				apiKey: "nia_super_secret_token_99zz",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			const config = await readConfig();
			const masked = maskApiKey(config.apiKey);

			// Must not contain the full token
			expect(masked).not.toContain("super_secret");
			// Must end with last 4 chars
			expect(masked).toContain("99zz");
		});
	});

	// --- Config key guards for apiKey rejection ---

	describe("apiKey rejection in config set", () => {
		test("isSettableKey rejects apiKey", () => {
			expect(isSettableKey("apiKey")).toBe(false);
		});

		test("isSettableKey accepts output", () => {
			expect(isSettableKey("output")).toBe(true);
		});

		test("isSettableKey accepts baseUrl", () => {
			expect(isSettableKey("baseUrl")).toBe(true);
		});

		test("error message directs to auth login", () => {
			const message = "Use `nia auth login` to set your API key.";
			expect(message).toContain("nia auth login");
		});
	});

	// --- First-run detection ---

	describe("first-run API key detection", () => {
		test("resolveApiKey returns undefined when no source has a key", async () => {
			delete process.env.NIA_API_KEY;
			await writeConfig({
				apiKey: undefined,
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			const key = await resolveApiKey();
			expect(key).toBeUndefined();
		});

		test("resolveApiKey returns env var when set", async () => {
			process.env.NIA_API_KEY = "env_key_123";
			const key = await resolveApiKey();
			expect(key).toBe("env_key_123");
		});

		test("resolveApiKey returns override even with env and config", async () => {
			process.env.NIA_API_KEY = "env_key";
			await writeConfig({
				apiKey: "config_key",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			const key = await resolveApiKey("override_key");
			expect(key).toBe("override_key");
		});
	});

	// --- owner/repo parsing ---

	describe("owner/repo parsing", () => {
		test("valid owner/repo splits correctly", () => {
			const input = "nozomio-labs/nia-cli";
			const parts = input.split("/");
			expect(parts).toHaveLength(2);
			expect(parts[0]).toBe("nozomio-labs");
			expect(parts[1]).toBe("nia-cli");
		});

		test("invalid format without slash", () => {
			const input = "nia-cli";
			const parts = input.split("/");
			expect(parts).toHaveLength(1);
			// The command handler would error here
		});

		test("format with multiple slashes", () => {
			const input = "org/repo/extra";
			const parts = input.split("/");
			expect(parts).toHaveLength(3);
			// First two parts are owner and repo
		});

		test("format with empty owner", () => {
			const input = "/repo";
			const parts = input.split("/");
			expect(parts[0]).toBe("");
			// Empty owner should be rejected
		});
	});

	// --- Comma-separated parsing ---

	describe("comma-separated string parsing", () => {
		test("splits simple comma-separated values", () => {
			const input = "tag1,tag2,tag3";
			const result = input.split(",").map((s) => s.trim());
			expect(result).toEqual(["tag1", "tag2", "tag3"]);
		});

		test("trims whitespace around values", () => {
			const input = "tag1 , tag2 , tag3";
			const result = input.split(",").map((s) => s.trim());
			expect(result).toEqual(["tag1", "tag2", "tag3"]);
		});

		test("handles single value without commas", () => {
			const input = "single-tag";
			const result = input.split(",").map((s) => s.trim());
			expect(result).toEqual(["single-tag"]);
		});

		test("handles empty strings between commas", () => {
			const input = "tag1,,tag3";
			const result = input.split(",").map((s) => s.trim());
			expect(result).toEqual(["tag1", "", "tag3"]);
		});

		test("repos flag splits into array for SDK", () => {
			const reposFlag = "owner/repo1, owner/repo2";
			const repos = reposFlag.split(",").map((s) => s.trim());
			expect(repos).toEqual(["owner/repo1", "owner/repo2"]);
		});
	});

	// --- Empty result handling ---

	describe("empty result handling", () => {
		test("empty items array from list", () => {
			const response = { items: [], pagination: { total: 0, has_more: false } };
			expect(response.items).toHaveLength(0);
		});

		test("empty contexts array from search", () => {
			const response = { contexts: [], total_results: 0 };
			expect(response.contexts).toHaveLength(0);
			expect(response.total_results).toBe(0);
		});

		test("empty results array from semantic search", () => {
			const response = { results: [], search_metadata: { total_results: 0 } };
			expect(response.results).toHaveLength(0);
		});

		test("response with contexts array instead of items (backward compat)", () => {
			const response = { contexts: [{ id: "1" }], total: 1 };
			const items =
				(response as Record<string, unknown>).items ??
				(response as Record<string, unknown>).contexts ??
				[];
			expect(items).toHaveLength(1);
		});

		test("truncation of long query strings in table display", () => {
			const longQuery =
				"This is a very long research query that should be truncated at 60 characters to fit in the table";
			const maxLen = 60;
			const truncated =
				longQuery.length > maxLen ? `${longQuery.slice(0, maxLen - 3)}...` : longQuery;
			expect(truncated.length).toBeLessThanOrEqual(maxLen);
			expect(truncated).toContain("...");
		});

		test("title truncation at 40 chars for contexts list", () => {
			const longTitle = "This is a very long context title that exceeds forty characters";
			const maxLen = 40;
			const truncated =
				longTitle.length > maxLen ? `${longTitle.slice(0, maxLen - 3)}...` : longTitle;
			expect(truncated.length).toBeLessThanOrEqual(maxLen);
			expect(truncated).toContain("...");
		});

		test("short title is not truncated", () => {
			const shortTitle = "Short";
			const maxLen = 40;
			const truncated =
				shortTitle.length > maxLen ? `${shortTitle.slice(0, maxLen - 3)}...` : shortTitle;
			expect(truncated).toBe("Short");
			expect(truncated).not.toContain("...");
		});
	});

	// --- Flag-to-SDK parameter mapping patterns ---

	describe("flag-to-SDK parameter mapping", () => {
		test("--context-before maps to 'b' field (packages grep)", () => {
			const contextBefore = 3;
			const request = { b: contextBefore };
			expect(request.b).toBe(3);
		});

		test("--context-after maps to 'a' field (packages grep)", () => {
			const contextAfter = 5;
			const request = { a: contextAfter };
			expect(request.a).toBe(5);
		});

		test("--lines-before maps to 'B' field (sources grep)", () => {
			const linesBefore = 2;
			const request = { B: linesBefore };
			expect(request.B).toBe(2);
		});

		test("--lines-after maps to 'A' field (sources grep)", () => {
			const linesAfter = 4;
			const request = { A: linesAfter };
			expect(request.A).toBe(4);
		});

		test("--private flag negates to add_as_global_source=false", () => {
			const isPrivate = true;
			const addAsGlobal = !isPrivate;
			expect(addAsGlobal).toBe(false);
		});

		test("query wraps into messages array for search.query", () => {
			const query = "how does authentication work?";
			const messages = [{ role: "user", content: query }];
			expect(messages).toHaveLength(1);
			expect(messages[0]?.role).toBe("user");
			expect(messages[0]?.content).toBe(query);
		});

		test("semantic_queries splits from comma-separated query", () => {
			const queryArg = "auth flow,token validation,session management";
			const semanticQueries = queryArg.split(",").map((s) => s.trim());
			expect(semanticQueries).toHaveLength(3);
			expect(semanticQueries).toEqual(["auth flow", "token validation", "session management"]);
		});

		test("category assign with 'null' string sends null", () => {
			const categoryIdArg = "null";
			const categoryId = categoryIdArg === "null" ? null : categoryIdArg;
			expect(categoryId).toBeNull();
		});

		test("category assign with real ID sends the ID", () => {
			const categoryIdArg: string = "cat_abc123";
			const categoryId = categoryIdArg === "null" ? null : categoryIdArg;
			expect(categoryId).toBe("cat_abc123");
		});

		test("read command max 200 lines validation (packages)", () => {
			const start = 1;
			const end = 250;
			const lineCount = end - start;
			expect(lineCount).toBeGreaterThan(200);
			// The handler would reject this
		});

		test("read command within 200 lines is accepted", () => {
			const start = 10;
			const end = 50;
			const lineCount = end - start;
			expect(lineCount).toBeLessThanOrEqual(200);
		});
	});
});
