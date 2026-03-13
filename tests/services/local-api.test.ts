import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	getConfigDirPath,
	resetConfig,
	writeConfig,
} from "../helpers/config-store.ts";

const mockFetch = mock();

describe("local api service", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}

		await writeConfig({
			apiKey: "nia_test_local_key",
			baseUrl: "https://apigcp.trynia.ai/v2",
			output: undefined,
		});

		mockFetch.mockClear();
		globalThis.fetch = mockFetch as unknown as typeof fetch;
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	test("listLocalSources calls daemon sources endpoint", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(
				JSON.stringify([{ local_folder_id: "src-123", display_name: "Demo" }]),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);

		const { listLocalSources } = await import(
			"../../src/services/local/api.ts"
		);
		const result = await listLocalSources();

		expect(mockFetch).toHaveBeenCalledWith(
			"https://apigcp.trynia.ai/v2/daemon/sources",
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Authorization: "Bearer nia_test_local_key",
				}),
			}),
		);
		expect(result[0]?.local_folder_id).toBe("src-123");
	});

	test("addLocalSource posts folder path and detected_type", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ local_folder_id: "src-123", display_name: "Demo" }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);

		const { addLocalSource } = await import("../../src/services/local/api.ts");
		await addLocalSource("/tmp/demo");

		expect(mockFetch).toHaveBeenCalledWith(
			"https://apigcp.trynia.ai/v2/daemon/sources",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					path: "/tmp/demo",
					detected_type: "folder",
				}),
			}),
		);
	});

	test("throws LocalApiError with status on non-2xx", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ detail: "backend unavailable" }), {
				status: 503,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const { listLocalSources, LocalApiError } = await import(
			"../../src/services/local/api.ts"
		);

		const error = (await listLocalSources().catch(
			(caught: unknown) => caught,
		)) as { status?: number };
		expect(error).toBeInstanceOf(LocalApiError);
		expect(error.status).toBe(503);
	});
});
