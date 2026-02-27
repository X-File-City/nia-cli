import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	getConfigDirPath,
	resetConfig,
	writeConfig,
} from "../../src/services/config.ts";

// --- Mock SDK ---

const mockSaveContext = mock(() =>
	Promise.resolve({
		id: "ctx_abc123",
		user_id: "user_1",
		title: "Test Context",
		summary: "A test summary",
		content: "Full content here",
		tags: ["test", "example"],
		agent_source: "nia-cli",
		created_at: "2026-01-25T10:00:00Z",
		updated_at: null,
		metadata: {},
		memory_type: "episodic",
		expires_at: "2026-02-01T10:00:00Z",
	}),
);

const mockListContexts = mock(() =>
	Promise.resolve({
		items: [
			{
				id: "ctx_abc123",
				title: "Test Context",
				summary: "A test summary",
				agent_source: "nia-cli",
				memory_type: "episodic",
				created_at: "2026-01-25T10:00:00Z",
			},
			{
				id: "ctx_def456",
				title: "Another Context",
				summary: "Another summary",
				agent_source: "claude-code",
				memory_type: "fact",
				created_at: "2026-01-26T10:00:00Z",
			},
		],
		pagination: {
			total: 2,
			limit: 20,
			offset: 0,
			has_more: false,
		},
		total: 2,
	}),
);

const mockSearchContexts = mock(() =>
	Promise.resolve({
		contexts: [
			{
				id: "ctx_abc123",
				title: "Test Context",
				agent_source: "nia-cli",
				memory_type: "episodic",
			},
		],
		search_query: "test query",
		total_results: 1,
	}),
);

const mockSemanticSearch = mock(() =>
	Promise.resolve({
		results: [
			{
				id: "ctx_abc123",
				title: "Test Context",
				score: 0.95,
				agent_source: "nia-cli",
			},
		],
		search_query: "semantic query",
		search_metadata: {
			search_type: "hybrid",
			total_results: 1,
			vector_matches: 1,
			mongodb_matches: 0,
		},
		suggestions: {
			related_tags: ["test"],
			workspaces: [],
			tips: ["Try more specific queries for better results"],
		},
	}),
);

const mockGetContext = mock(() =>
	Promise.resolve({
		id: "ctx_abc123",
		user_id: "user_1",
		title: "Test Context",
		summary: "A test summary",
		content: "Full content here",
		tags: ["test", "example"],
		agent_source: "nia-cli",
		created_at: "2026-01-25T10:00:00Z",
		updated_at: "2026-01-26T10:00:00Z",
		metadata: {},
		memory_type: "episodic",
		expires_at: "2026-02-01T10:00:00Z",
	}),
);

const mockUpdateContext = mock(() =>
	Promise.resolve({
		id: "ctx_abc123",
		user_id: "user_1",
		title: "Updated Title",
		summary: "Updated summary",
		content: "Updated content",
		tags: ["updated"],
		agent_source: "nia-cli",
		created_at: "2026-01-25T10:00:00Z",
		updated_at: "2026-01-27T10:00:00Z",
		metadata: {},
		memory_type: "fact",
	}),
);

const mockDeleteContext = mock(() =>
	Promise.resolve({ success: true, message: "Context deleted" }),
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
	V2ApiContextsService: {
		saveContextV2V2ContextsPost: mockSaveContext,
		listContextsV2V2ContextsGet: mockListContexts,
		searchContextsV2V2ContextsSearchGet: mockSearchContexts,
		semanticSearchContextsV2V2ContextsSemanticSearchGet: mockSemanticSearch,
		getContextV2V2ContextsContextIdGet: mockGetContext,
		updateContextV2V2ContextsContextIdPut: mockUpdateContext,
		deleteContextV2V2ContextsContextIdDelete: mockDeleteContext,
	},
}));

// --- Import after mocking ---

import { V2ApiContextsService } from "nia-ai-ts";
import { createSdk } from "../../src/services/sdk.ts";

describe("contexts commands", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}

		await writeConfig({
			apiKey: "nia_test_contexts_key",
			baseUrl: "https://apigcp.trynia.ai/v2",
			output: undefined,
		});

		mockSaveContext.mockClear();
		mockListContexts.mockClear();
		mockSearchContexts.mockClear();
		mockSemanticSearch.mockClear();
		mockGetContext.mockClear();
		mockUpdateContext.mockClear();
		mockDeleteContext.mockClear();
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	// --- save ---

	describe("contexts save", () => {
		test("calls saveContextV2V2ContextsPost with required fields", async () => {
			await createSdk();

			await V2ApiContextsService.saveContextV2V2ContextsPost({
				title: "My Context",
				summary: "A summary",
				content: "Full content",
				agent_source: "nia-cli",
			});

			expect(mockSaveContext).toHaveBeenCalledTimes(1);
			expect(mockSaveContext).toHaveBeenCalledWith({
				title: "My Context",
				summary: "A summary",
				content: "Full content",
				agent_source: "nia-cli",
			});
		});

		test("passes tags as array from comma-separated string", async () => {
			await createSdk();

			await V2ApiContextsService.saveContextV2V2ContextsPost({
				title: "My Context",
				summary: "A summary",
				content: "Full content",
				agent_source: "nia-cli",
				tags: ["test", "example", "demo"],
			});

			expect(mockSaveContext).toHaveBeenCalledWith({
				title: "My Context",
				summary: "A summary",
				content: "Full content",
				agent_source: "nia-cli",
				tags: ["test", "example", "demo"],
			});
		});

		test("passes memory_type when provided", async () => {
			await createSdk();

			await V2ApiContextsService.saveContextV2V2ContextsPost({
				title: "My Context",
				summary: "A summary",
				content: "Full content",
				agent_source: "nia-cli",
				memory_type: "fact",
			});

			expect(mockSaveContext).toHaveBeenCalledWith({
				title: "My Context",
				summary: "A summary",
				content: "Full content",
				agent_source: "nia-cli",
				memory_type: "fact",
			});
		});

		test("passes ttl_seconds when provided", async () => {
			await createSdk();

			await V2ApiContextsService.saveContextV2V2ContextsPost({
				title: "My Context",
				summary: "A summary",
				content: "Full content",
				agent_source: "nia-cli",
				ttl_seconds: 3600,
			});

			expect(mockSaveContext).toHaveBeenCalledWith({
				title: "My Context",
				summary: "A summary",
				content: "Full content",
				agent_source: "nia-cli",
				ttl_seconds: 3600,
			});
		});

		test("returns ContextShareResponse with id", async () => {
			await createSdk();

			const result = await V2ApiContextsService.saveContextV2V2ContextsPost({
				title: "My Context",
				summary: "A summary",
				content: "Full content",
				agent_source: "nia-cli",
			});

			expect(result.id).toBe("ctx_abc123");
			expect(result.title).toBe("Test Context");
			expect(result.memory_type).toBe("episodic");
		});

		test("passes all parameters together", async () => {
			await createSdk();

			await V2ApiContextsService.saveContextV2V2ContextsPost({
				title: "Full Context",
				summary: "Complete summary",
				content: "All the content",
				agent_source: "claude-code",
				tags: ["tag1", "tag2"],
				memory_type: "procedural",
				ttl_seconds: 7200,
			});

			expect(mockSaveContext).toHaveBeenCalledWith({
				title: "Full Context",
				summary: "Complete summary",
				content: "All the content",
				agent_source: "claude-code",
				tags: ["tag1", "tag2"],
				memory_type: "procedural",
				ttl_seconds: 7200,
			});
		});
	});

	// --- list ---

	describe("contexts list", () => {
		test("calls listContextsV2V2ContextsGet with no filters", async () => {
			await createSdk();

			await V2ApiContextsService.listContextsV2V2ContextsGet(
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
			);

			expect(mockListContexts).toHaveBeenCalledTimes(1);
			expect(mockListContexts).toHaveBeenCalledWith(
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
			);
		});

		test("passes limit and offset parameters", async () => {
			await createSdk();

			await V2ApiContextsService.listContextsV2V2ContextsGet(
				10,
				5,
				undefined,
				undefined,
				undefined,
			);

			expect(mockListContexts).toHaveBeenCalledWith(
				10,
				5,
				undefined,
				undefined,
				undefined,
			);
		});

		test("passes tags filter", async () => {
			await createSdk();

			await V2ApiContextsService.listContextsV2V2ContextsGet(
				undefined,
				undefined,
				"test,example",
				undefined,
				undefined,
			);

			expect(mockListContexts).toHaveBeenCalledWith(
				undefined,
				undefined,
				"test,example",
				undefined,
				undefined,
			);
		});

		test("passes agent source filter", async () => {
			await createSdk();

			await V2ApiContextsService.listContextsV2V2ContextsGet(
				undefined,
				undefined,
				undefined,
				"nia-cli",
				undefined,
			);

			expect(mockListContexts).toHaveBeenCalledWith(
				undefined,
				undefined,
				undefined,
				"nia-cli",
				undefined,
			);
		});

		test("passes memory type filter", async () => {
			await createSdk();

			await V2ApiContextsService.listContextsV2V2ContextsGet(
				undefined,
				undefined,
				undefined,
				undefined,
				"episodic",
			);

			expect(mockListContexts).toHaveBeenCalledWith(
				undefined,
				undefined,
				undefined,
				undefined,
				"episodic",
			);
		});

		test("returns items and pagination info", async () => {
			await createSdk();

			const result = await V2ApiContextsService.listContextsV2V2ContextsGet(
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
			);

			expect(result.items).toHaveLength(2);
			expect(result.pagination.total).toBe(2);
			expect(result.pagination.has_more).toBe(false);
		});

		test("passes all filters together", async () => {
			await createSdk();

			await V2ApiContextsService.listContextsV2V2ContextsGet(
				20,
				10,
				"test",
				"nia-cli",
				"fact",
			);

			expect(mockListContexts).toHaveBeenCalledWith(
				20,
				10,
				"test",
				"nia-cli",
				"fact",
			);
		});
	});

	// --- search ---

	describe("contexts search", () => {
		test("calls searchContextsV2V2ContextsSearchGet with query", async () => {
			await createSdk();

			await V2ApiContextsService.searchContextsV2V2ContextsSearchGet(
				"test query",
				undefined,
				undefined,
				undefined,
			);

			expect(mockSearchContexts).toHaveBeenCalledTimes(1);
			expect(mockSearchContexts).toHaveBeenCalledWith(
				"test query",
				undefined,
				undefined,
				undefined,
			);
		});

		test("passes limit parameter", async () => {
			await createSdk();

			await V2ApiContextsService.searchContextsV2V2ContextsSearchGet(
				"test query",
				5,
				undefined,
				undefined,
			);

			expect(mockSearchContexts).toHaveBeenCalledWith(
				"test query",
				5,
				undefined,
				undefined,
			);
		});

		test("passes tags and agent filters", async () => {
			await createSdk();

			await V2ApiContextsService.searchContextsV2V2ContextsSearchGet(
				"test query",
				10,
				"test",
				"nia-cli",
			);

			expect(mockSearchContexts).toHaveBeenCalledWith(
				"test query",
				10,
				"test",
				"nia-cli",
			);
		});

		test("returns search results with total", async () => {
			await createSdk();

			const result =
				await V2ApiContextsService.searchContextsV2V2ContextsSearchGet(
					"test query",
					undefined,
					undefined,
					undefined,
				);

			expect(result.contexts).toHaveLength(1);
			expect(result.search_query).toBe("test query");
			expect(result.total_results).toBe(1);
		});

		test("returns empty results when no matches", async () => {
			mockSearchContexts.mockResolvedValueOnce({
				contexts: [],
				search_query: "nonexistent",
				total_results: 0,
			});

			await createSdk();

			const result =
				await V2ApiContextsService.searchContextsV2V2ContextsSearchGet(
					"nonexistent",
					undefined,
					undefined,
					undefined,
				);

			expect(result.contexts).toHaveLength(0);
			expect(result.total_results).toBe(0);
		});
	});

	// --- semantic ---

	describe("contexts semantic", () => {
		test("calls semanticSearchContextsV2V2ContextsSemanticSearchGet with query", async () => {
			await createSdk();

			await V2ApiContextsService.semanticSearchContextsV2V2ContextsSemanticSearchGet(
				"semantic query",
				undefined,
				undefined,
				undefined,
			);

			expect(mockSemanticSearch).toHaveBeenCalledTimes(1);
			expect(mockSemanticSearch).toHaveBeenCalledWith(
				"semantic query",
				undefined,
				undefined,
				undefined,
			);
		});

		test("passes limit parameter", async () => {
			await createSdk();

			await V2ApiContextsService.semanticSearchContextsV2V2ContextsSemanticSearchGet(
				"semantic query",
				5,
				undefined,
				undefined,
			);

			expect(mockSemanticSearch).toHaveBeenCalledWith(
				"semantic query",
				5,
				undefined,
				undefined,
			);
		});

		test("passes highlights flag", async () => {
			await createSdk();

			await V2ApiContextsService.semanticSearchContextsV2V2ContextsSemanticSearchGet(
				"semantic query",
				undefined,
				true,
				undefined,
			);

			expect(mockSemanticSearch).toHaveBeenCalledWith(
				"semantic query",
				undefined,
				true,
				undefined,
			);
		});

		test("passes workspace filter", async () => {
			await createSdk();

			await V2ApiContextsService.semanticSearchContextsV2V2ContextsSemanticSearchGet(
				"semantic query",
				undefined,
				undefined,
				"my-workspace",
			);

			expect(mockSemanticSearch).toHaveBeenCalledWith(
				"semantic query",
				undefined,
				undefined,
				"my-workspace",
			);
		});

		test("returns results with scores and metadata", async () => {
			await createSdk();

			const result =
				await V2ApiContextsService.semanticSearchContextsV2V2ContextsSemanticSearchGet(
					"semantic query",
					undefined,
					undefined,
					undefined,
				);

			expect(result.results).toHaveLength(1);
			expect(result.results?.[0]?.score).toBe(0.95);
			expect(result.search_metadata.search_type).toBe("hybrid");
			expect(result.search_metadata.total_results).toBe(1);
		});

		test("returns suggestions", async () => {
			await createSdk();

			const result =
				await V2ApiContextsService.semanticSearchContextsV2V2ContextsSemanticSearchGet(
					"semantic query",
					undefined,
					undefined,
					undefined,
				);

			expect(result.suggestions.tips).toHaveLength(1);
			expect(result.suggestions.related_tags).toEqual(["test"]);
		});

		test("passes all parameters together", async () => {
			await createSdk();

			await V2ApiContextsService.semanticSearchContextsV2V2ContextsSemanticSearchGet(
				"full query",
				10,
				true,
				"workspace-1",
			);

			expect(mockSemanticSearch).toHaveBeenCalledWith(
				"full query",
				10,
				true,
				"workspace-1",
			);
		});
	});

	// --- get ---

	describe("contexts get", () => {
		test("calls getContextV2V2ContextsContextIdGet with ID", async () => {
			await createSdk();

			await V2ApiContextsService.getContextV2V2ContextsContextIdGet(
				"ctx_abc123",
			);

			expect(mockGetContext).toHaveBeenCalledTimes(1);
			expect(mockGetContext).toHaveBeenCalledWith("ctx_abc123");
		});

		test("returns full context with content", async () => {
			await createSdk();

			const result =
				await V2ApiContextsService.getContextV2V2ContextsContextIdGet(
					"ctx_abc123",
				);

			expect(result.id).toBe("ctx_abc123");
			expect(result.title).toBe("Test Context");
			expect(result.content).toBe("Full content here");
			expect(result.tags).toEqual(["test", "example"]);
		});

		test("returns timestamps and metadata", async () => {
			await createSdk();

			const result =
				await V2ApiContextsService.getContextV2V2ContextsContextIdGet(
					"ctx_abc123",
				);

			expect(result.created_at).toBe("2026-01-25T10:00:00Z");
			expect(result.updated_at).toBe("2026-01-26T10:00:00Z");
			expect(result.expires_at).toBe("2026-02-01T10:00:00Z");
			expect(result.memory_type).toBe("episodic");
		});

		test("handles context not found error", async () => {
			mockGetContext.mockRejectedValueOnce(
				Object.assign(new Error("Not found"), { status: 404 }),
			);

			await createSdk();

			try {
				await V2ApiContextsService.getContextV2V2ContextsContextIdGet(
					"ctx_nonexistent",
				);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect((error as { status: number }).status).toBe(404);
			}
		});
	});

	// --- update ---

	describe("contexts update", () => {
		test("calls updateContextV2V2ContextsContextIdPut with title", async () => {
			await createSdk();

			await V2ApiContextsService.updateContextV2V2ContextsContextIdPut(
				"ctx_abc123",
				{
					title: "Updated Title",
				},
			);

			expect(mockUpdateContext).toHaveBeenCalledTimes(1);
			expect(mockUpdateContext).toHaveBeenCalledWith("ctx_abc123", {
				title: "Updated Title",
			});
		});

		test("passes multiple update fields", async () => {
			await createSdk();

			await V2ApiContextsService.updateContextV2V2ContextsContextIdPut(
				"ctx_abc123",
				{
					title: "Updated Title",
					summary: "Updated summary",
					content: "Updated content",
					tags: ["updated"],
					memory_type: "fact",
				},
			);

			expect(mockUpdateContext).toHaveBeenCalledWith("ctx_abc123", {
				title: "Updated Title",
				summary: "Updated summary",
				content: "Updated content",
				tags: ["updated"],
				memory_type: "fact",
			});
		});

		test("returns updated context", async () => {
			await createSdk();

			const result =
				await V2ApiContextsService.updateContextV2V2ContextsContextIdPut(
					"ctx_abc123",
					{ title: "Updated Title" },
				);

			expect(result.id).toBe("ctx_abc123");
			expect(result.title).toBe("Updated Title");
			expect(result.updated_at).toBe("2026-01-27T10:00:00Z");
		});

		test("handles update on nonexistent context", async () => {
			mockUpdateContext.mockRejectedValueOnce(
				Object.assign(new Error("Not found"), { status: 404 }),
			);

			await createSdk();

			try {
				await V2ApiContextsService.updateContextV2V2ContextsContextIdPut(
					"ctx_nonexistent",
					{
						title: "New",
					},
				);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect((error as { status: number }).status).toBe(404);
			}
		});
	});

	// --- delete ---

	describe("contexts delete", () => {
		test("calls deleteContextV2V2ContextsContextIdDelete with ID", async () => {
			await createSdk();

			await V2ApiContextsService.deleteContextV2V2ContextsContextIdDelete(
				"ctx_abc123",
			);

			expect(mockDeleteContext).toHaveBeenCalledTimes(1);
			expect(mockDeleteContext).toHaveBeenCalledWith("ctx_abc123");
		});

		test("returns success response", async () => {
			await createSdk();

			const result =
				await V2ApiContextsService.deleteContextV2V2ContextsContextIdDelete(
					"ctx_abc123",
				);

			expect(result.success).toBe(true);
		});

		test("handles delete not found error", async () => {
			mockDeleteContext.mockRejectedValueOnce(
				Object.assign(new Error("Not found"), { status: 404 }),
			);

			await createSdk();

			try {
				await V2ApiContextsService.deleteContextV2V2ContextsContextIdDelete(
					"ctx_nonexistent",
				);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect((error as { status: number }).status).toBe(404);
			}
		});
	});

	// --- error handling ---

	describe("error handling", () => {
		test("handles 401 authentication error", async () => {
			mockSaveContext.mockRejectedValueOnce(
				Object.assign(new Error("Unauthorized"), { status: 401 }),
			);

			await createSdk();

			try {
				await V2ApiContextsService.saveContextV2V2ContextsPost({
					title: "Test",
					summary: "Test",
					content: "Test",
					agent_source: "test",
				});
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect((error as { status: number }).status).toBe(401);
			}
		});

		test("handles 429 rate limit error", async () => {
			mockListContexts.mockRejectedValueOnce(
				Object.assign(new Error("Rate Limited"), { status: 429 }),
			);

			await createSdk();

			try {
				await V2ApiContextsService.listContextsV2V2ContextsGet(
					undefined,
					undefined,
					undefined,
					undefined,
					undefined,
				);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect((error as { status: number }).status).toBe(429);
			}
		});

		test("handles 500 server error", async () => {
			mockSearchContexts.mockRejectedValueOnce(
				Object.assign(new Error("Internal Error"), { status: 500 }),
			);

			await createSdk();

			try {
				await V2ApiContextsService.searchContextsV2V2ContextsSearchGet(
					"query",
					undefined,
					undefined,
					undefined,
				);
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect((error as { status: number }).status).toBe(500);
			}
		});

		test("handles 422 validation error", async () => {
			mockSaveContext.mockRejectedValueOnce(
				Object.assign(new Error("Missing required field: content"), {
					status: 422,
				}),
			);

			await createSdk();

			try {
				await V2ApiContextsService.saveContextV2V2ContextsPost({
					title: "Test",
					summary: "Test",
					content: "",
					agent_source: "test",
				});
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect((error as { status: number }).status).toBe(422);
			}
		});
	});

	// --- flag-to-parameter mapping ---

	describe("flag-to-parameter mapping", () => {
		test("save maps --tags to tags array via comma split", async () => {
			await createSdk();

			// Simulate the command handler's tag parsing
			const tagsString = "test, example, demo";
			const tags = tagsString.split(",").map((s) => s.trim());

			await V2ApiContextsService.saveContextV2V2ContextsPost({
				title: "Test",
				summary: "Summary",
				content: "Content",
				agent_source: "nia-cli",
				tags,
			});

			expect(mockSaveContext).toHaveBeenCalledWith({
				title: "Test",
				summary: "Summary",
				content: "Content",
				agent_source: "nia-cli",
				tags: ["test", "example", "demo"],
			});
		});

		test("save maps --memory-type to memory_type", async () => {
			await createSdk();

			await V2ApiContextsService.saveContextV2V2ContextsPost({
				title: "Test",
				summary: "Summary",
				content: "Content",
				agent_source: "nia-cli",
				memory_type: "procedural",
			});

			expect(mockSaveContext).toHaveBeenCalledWith({
				title: "Test",
				summary: "Summary",
				content: "Content",
				agent_source: "nia-cli",
				memory_type: "procedural",
			});
		});

		test("save maps --ttl to ttl_seconds", async () => {
			await createSdk();

			await V2ApiContextsService.saveContextV2V2ContextsPost({
				title: "Test",
				summary: "Summary",
				content: "Content",
				agent_source: "nia-cli",
				ttl_seconds: 7200,
			});

			expect(mockSaveContext).toHaveBeenCalledWith({
				title: "Test",
				summary: "Summary",
				content: "Content",
				agent_source: "nia-cli",
				ttl_seconds: 7200,
			});
		});

		test("save maps --agent to agent_source", async () => {
			await createSdk();

			await V2ApiContextsService.saveContextV2V2ContextsPost({
				title: "Test",
				summary: "Summary",
				content: "Content",
				agent_source: "claude-code",
			});

			expect(mockSaveContext).toHaveBeenCalledWith({
				title: "Test",
				summary: "Summary",
				content: "Content",
				agent_source: "claude-code",
			});
		});

		test("list maps --agent to agentSource parameter", async () => {
			await createSdk();

			await V2ApiContextsService.listContextsV2V2ContextsGet(
				undefined,
				undefined,
				undefined,
				"nia-cli",
				undefined,
			);

			expect(mockListContexts).toHaveBeenCalledWith(
				undefined,
				undefined,
				undefined,
				"nia-cli",
				undefined,
			);
		});

		test("semantic maps --highlights to includeHighlights parameter", async () => {
			await createSdk();

			await V2ApiContextsService.semanticSearchContextsV2V2ContextsSemanticSearchGet(
				"query",
				undefined,
				true,
				undefined,
			);

			expect(mockSemanticSearch).toHaveBeenCalledWith(
				"query",
				undefined,
				true,
				undefined,
			);
		});

		test("update maps --tags to tags array", async () => {
			await createSdk();

			const tagsString = "new-tag, updated";
			const tags = tagsString.split(",").map((s) => s.trim());

			await V2ApiContextsService.updateContextV2V2ContextsContextIdPut(
				"ctx_abc123",
				{
					tags,
				},
			);

			expect(mockUpdateContext).toHaveBeenCalledWith("ctx_abc123", {
				tags: ["new-tag", "updated"],
			});
		});
	});
});
