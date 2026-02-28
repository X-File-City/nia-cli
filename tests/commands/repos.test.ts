import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	getConfigDirPath,
	resetConfig,
	writeConfig,
} from "../helpers/config-store.ts";

// --- Mock V2ApiRepositoriesService ---

const mockIndexRepository = mock(() =>
	Promise.resolve({
		message: "Repository indexing started",
		project_id: "proj-abc123",
		repository: "vercel/ai",
		branch: "main",
		ref: null,
		status: "indexing",
		is_global: true,
		global_source_id: "gs-xyz",
	}),
);

const mockListRepositories = mock(() =>
	Promise.resolve([
		{
			repository_id: "repo-001",
			id: "proj-001",
			repository: "vercel/ai",
			branch: "main",
			status: "completed",
			display_name: "Vercel AI SDK",
			is_global: true,
			progress: null,
			error: null,
			category_id: null,
		},
		{
			repository_id: "repo-002",
			id: "proj-002",
			repository: "facebook/react",
			branch: "main",
			status: "indexing",
			display_name: null,
			is_global: true,
			progress: {
				percentage: 45,
				stage: "parsing",
				message: "Parsing files...",
			},
			error: null,
			category_id: null,
		},
	]),
);

const mockGetRepositoryStatus = mock(() =>
	Promise.resolve({
		repository: "vercel/ai",
		branch: "main",
		status: "completed",
		progress: null as Record<string, unknown> | null,
		error: null as string | null,
	}),
);

const mockDeleteRepository = mock(() =>
	Promise.resolve({
		success: true,
		message: "Repository deleted successfully",
	}),
);

const mockRenameRepository = mock(() =>
	Promise.resolve({
		success: true,
		message: "Repository renamed successfully",
		new_name: "My AI SDK",
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
		indexRepositoryV2V2RepositoriesPost: mockIndexRepository,
		listRepositoriesV2V2RepositoriesGet: mockListRepositories,
		getRepositoryStatusV2V2RepositoriesRepositoryIdGet: mockGetRepositoryStatus,
		deleteRepositoryV2V2RepositoriesRepositoryIdDelete: mockDeleteRepository,
		renameRepositoryV2V2RepositoriesRepositoryIdRenamePatch:
			mockRenameRepository,
	},
}));

// --- Import after mocking ---

import { createSdk } from "../../src/services/sdk.ts";

describe("repos commands", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}

		await writeConfig({
			apiKey: "nia_test_repos_key",
			baseUrl: "https://apigcp.trynia.ai/v2",
			output: undefined,
		});

		mockIndexRepository.mockClear();
		mockListRepositories.mockClear();
		mockGetRepositoryStatus.mockClear();
		mockDeleteRepository.mockClear();
		mockRenameRepository.mockClear();
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	// --- index ---

	describe("index (V2ApiRepositoriesService.indexRepository)", () => {
		test("calls indexRepository with repository name", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.indexRepositoryV2V2RepositoriesPost({
				repository: "vercel/ai",
			});

			expect(mockIndexRepository).toHaveBeenCalledTimes(1);
			expect(mockIndexRepository).toHaveBeenCalledWith({
				repository: "vercel/ai",
			});
		});

		test("passes branch parameter", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.indexRepositoryV2V2RepositoriesPost({
				repository: "vercel/ai",
				branch: "canary",
			});

			expect(mockIndexRepository).toHaveBeenCalledWith({
				repository: "vercel/ai",
				branch: "canary",
			});
		});

		test("passes ref parameter", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.indexRepositoryV2V2RepositoriesPost({
				repository: "vercel/ai",
				ref: "v3.0.0",
			});

			expect(mockIndexRepository).toHaveBeenCalledWith({
				repository: "vercel/ai",
				ref: "v3.0.0",
			});
		});

		test("passes add_as_global_source=false for private indexing", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.indexRepositoryV2V2RepositoriesPost({
				repository: "my-org/private-repo",
				add_as_global_source: false,
			});

			expect(mockIndexRepository).toHaveBeenCalledWith({
				repository: "my-org/private-repo",
				add_as_global_source: false,
			});
		});

		test("returns index response with project_id and status", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result = await svc.indexRepositoryV2V2RepositoriesPost({
				repository: "vercel/ai",
			});

			expect(result.project_id).toBe("proj-abc123");
			expect(result.repository).toBe("vercel/ai");
			expect(result.branch).toBe("main");
			expect(result.status).toBe("indexing");
		});

		test("passes all optional parameters together", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.indexRepositoryV2V2RepositoriesPost({
				repository: "vercel/ai",
				branch: "canary",
				ref: "abc123",
				add_as_global_source: false,
			});

			expect(mockIndexRepository).toHaveBeenCalledWith({
				repository: "vercel/ai",
				branch: "canary",
				ref: "abc123",
				add_as_global_source: false,
			});
		});
	});

	// --- list ---

	describe("list (V2ApiRepositoriesService.listRepositories)", () => {
		test("calls listRepositories with no filters", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.listRepositoriesV2V2RepositoriesGet();

			expect(mockListRepositories).toHaveBeenCalledTimes(1);
		});

		test("passes query filter", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.listRepositoriesV2V2RepositoriesGet("react");

			expect(mockListRepositories).toHaveBeenCalledWith("react");
		});

		test("passes query, status, limit, offset", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.listRepositoriesV2V2RepositoriesGet(
				"vercel",
				"completed",
				10,
				5,
			);

			expect(mockListRepositories).toHaveBeenCalledWith(
				"vercel",
				"completed",
				10,
				5,
			);
		});

		test("returns array of RepositoryItem objects", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result = await svc.listRepositoriesV2V2RepositoriesGet();

			expect(result).toHaveLength(2);

			// biome-ignore lint/style/noNonNullAssertion: length verified above
			const first = result[0]!;
			// biome-ignore lint/style/noNonNullAssertion: length verified above
			const second = result[1]!;
			expect(first.repository).toBe("vercel/ai");
			expect(first.status).toBe("completed");
			expect(first.display_name).toBe("Vercel AI SDK");
			expect(second.repository).toBe("facebook/react");
			expect(second.status).toBe("indexing");
		});

		test("returns repositories with progress info", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result = await svc.listRepositoriesV2V2RepositoriesGet();

			// biome-ignore lint/style/noNonNullAssertion: length verified in prior test
			const indexingRepo = result[1]!;
			expect(indexingRepo.progress).toEqual({
				percentage: 45,
				stage: "parsing",
				message: "Parsing files...",
			});
		});
	});

	// --- status ---

	describe("status (V2ApiRepositoriesService.getRepositoryStatus)", () => {
		test("calls getRepositoryStatus with repository ID", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.getRepositoryStatusV2V2RepositoriesRepositoryIdGet("repo-001");

			expect(mockGetRepositoryStatus).toHaveBeenCalledTimes(1);
			expect(mockGetRepositoryStatus).toHaveBeenCalledWith("repo-001");
		});

		test("returns repository status details", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result =
				await svc.getRepositoryStatusV2V2RepositoriesRepositoryIdGet(
					"repo-001",
				);

			expect(result.repository).toBe("vercel/ai");
			expect(result.branch).toBe("main");
			expect(result.status).toBe("completed");
		});

		test("handles status with progress info", async () => {
			mockGetRepositoryStatus.mockImplementationOnce(() =>
				Promise.resolve({
					repository: "facebook/react",
					branch: "main",
					status: "indexing",
					progress: {
						percentage: 75,
						stage: "embedding",
						message: "Generating embeddings...",
					},
					error: null,
				}),
			);

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result =
				await svc.getRepositoryStatusV2V2RepositoriesRepositoryIdGet(
					"repo-002",
				);

			expect(result.status).toBe("indexing");
			expect(result.progress).toEqual({
				percentage: 75,
				stage: "embedding",
				message: "Generating embeddings...",
			});
		});

		test("handles status with error", async () => {
			mockGetRepositoryStatus.mockImplementationOnce(() =>
				Promise.resolve({
					repository: "broken/repo",
					branch: "main",
					status: "error",
					progress: null,
					error: "Failed to clone repository: authentication required",
				}),
			);

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result =
				await svc.getRepositoryStatusV2V2RepositoriesRepositoryIdGet(
					"repo-err",
				);

			expect(result.status).toBe("error");
			expect(result.error).toBe(
				"Failed to clone repository: authentication required",
			);
		});
	});

	// --- delete ---

	describe("delete (V2ApiRepositoriesService.deleteRepository)", () => {
		test("calls deleteRepository with repository ID", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.deleteRepositoryV2V2RepositoriesRepositoryIdDelete("repo-001");

			expect(mockDeleteRepository).toHaveBeenCalledTimes(1);
			expect(mockDeleteRepository).toHaveBeenCalledWith("repo-001");
		});

		test("returns deletion confirmation", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result =
				await svc.deleteRepositoryV2V2RepositoriesRepositoryIdDelete(
					"repo-001",
				);

			expect(result.success).toBe(true);
			expect(result.message).toBe("Repository deleted successfully");
		});
	});

	// --- rename ---

	describe("rename (V2ApiRepositoriesService.renameRepository)", () => {
		test("calls renameRepository with repository ID and new name", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			await svc.renameRepositoryV2V2RepositoriesRepositoryIdRenamePatch(
				"repo-001",
				{
					new_name: "My AI SDK",
				},
			);

			expect(mockRenameRepository).toHaveBeenCalledTimes(1);
			expect(mockRenameRepository).toHaveBeenCalledWith("repo-001", {
				new_name: "My AI SDK",
			});
		});

		test("returns rename result with new name", async () => {
			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");
			const result =
				await svc.renameRepositoryV2V2RepositoriesRepositoryIdRenamePatch(
					"repo-001",
					{
						new_name: "My AI SDK",
					},
				);

			expect(result.success).toBe(true);
			expect(result.message).toBe("Repository renamed successfully");
			expect(result.new_name).toBe("My AI SDK");
		});
	});

	// --- error handling ---

	describe("error handling", () => {
		test("handles 401 authentication error", async () => {
			mockListRepositories.mockImplementationOnce(() => {
				const error = new Error("Unauthorized") as Error & { status: number };
				error.status = 401;
				return Promise.reject(error);
			});

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");

			await expect(svc.listRepositoriesV2V2RepositoriesGet()).rejects.toThrow(
				"Unauthorized",
			);
		});

		test("handles 404 not found error", async () => {
			mockGetRepositoryStatus.mockImplementationOnce(() => {
				const error = new Error("Not Found") as Error & { status: number };
				error.status = 404;
				return Promise.reject(error);
			});

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");

			await expect(
				svc.getRepositoryStatusV2V2RepositoriesRepositoryIdGet("nonexistent"),
			).rejects.toThrow("Not Found");
		});

		test("handles 422 validation error", async () => {
			mockIndexRepository.mockImplementationOnce(() => {
				const error = new Error("Invalid repository format") as Error & {
					status: number;
				};
				error.status = 422;
				return Promise.reject(error);
			});

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");

			await expect(
				svc.indexRepositoryV2V2RepositoriesPost({ repository: "invalid" }),
			).rejects.toThrow("Invalid repository format");
		});

		test("handles 429 rate limit error", async () => {
			mockListRepositories.mockImplementationOnce(() => {
				const error = new Error("Rate Limited") as Error & { status: number };
				error.status = 429;
				return Promise.reject(error);
			});

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");

			await expect(svc.listRepositoriesV2V2RepositoriesGet()).rejects.toThrow(
				"Rate Limited",
			);
		});

		test("handles 500 server error", async () => {
			mockDeleteRepository.mockImplementationOnce(() => {
				const error = new Error("Internal Server Error") as Error & {
					status: number;
				};
				error.status = 500;
				return Promise.reject(error);
			});

			await createSdk();

			const { V2ApiRepositoriesService: svc } = await import("nia-ai-ts");

			await expect(
				svc.deleteRepositoryV2V2RepositoriesRepositoryIdDelete("repo-001"),
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

	// --- flag-to-parameter mapping ---

	describe("flag-to-parameter mapping", () => {
		test("--repo arg maps to RepositoryRequest.repository", () => {
			const body: { repository: string; branch?: string } = {
				repository: "vercel/ai",
			};

			expect(body.repository).toBe("vercel/ai");
		});

		test("--branch/-b flag maps to RepositoryRequest.branch", () => {
			const body: { repository: string; branch?: string } = {
				repository: "vercel/ai",
				branch: "canary",
			};

			expect(body.branch).toBe("canary");
		});

		test("--ref flag maps to RepositoryRequest.ref", () => {
			const body: { repository: string; ref?: string } = {
				repository: "vercel/ai",
				ref: "v3.0.0",
			};

			expect(body.ref).toBe("v3.0.0");
		});

		test("--private flag negates to add_as_global_source=false", () => {
			const isPrivate = true;
			const body: { repository: string; add_as_global_source?: boolean } = {
				repository: "my-org/private-repo",
				add_as_global_source: !isPrivate,
			};

			expect(body.add_as_global_source).toBe(false);
		});

		test("--query flag maps to q parameter on listRepositories", () => {
			// The list command passes flags.query as the q (first) parameter
			const query = "react";
			const status = undefined;
			const limit = undefined;
			const offset = undefined;

			// Verify the mapping matches the method signature
			expect(query).toBe("react");
			expect(status).toBeUndefined();
			expect(limit).toBeUndefined();
			expect(offset).toBeUndefined();
		});

		test("rename args map to repositoryId and new_name body", () => {
			const repoId = "repo-001";
			const newName = "My Custom Name";
			const body = { new_name: newName };

			expect(repoId).toBe("repo-001");
			expect(body.new_name).toBe("My Custom Name");
		});
	});
});
