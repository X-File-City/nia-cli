import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	getConfigDirPath,
	resetConfig,
	writeConfig,
} from "../helpers/config-store.ts";

const mockFetch = mock();

describe("local sync service", () => {
	let tempDir: string;

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

		tempDir = path.join(os.tmpdir(), `nia-sync-${Date.now()}-${Math.random()}`);
		mkdirSync(tempDir, { recursive: true });
		writeFileSync(path.join(tempDir, "main.ts"), "console.log('sync');");

		mockFetch.mockClear();
		globalThis.fetch = mockFetch as unknown as typeof fetch;
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	test("uploads extracted files and updates cursor", async () => {
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ status: "ok", chunks_indexed: 1 }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const { syncLocalSource } = await import(
			"../../src/services/local/sync.ts"
		);
		const source = {
			local_folder_id: "src-123",
			display_name: "Demo",
			path: tempDir,
			detected_type: "folder",
			cursor: {},
		};

		const result = await syncLocalSource(source);

		expect(result.status).toBe("success");
		expect(result.added).toBe(1);
		expect(source.cursor).toMatchObject({
			cursor_version: 1,
			root_path: tempDir,
		});

		const [, request] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(request.method).toBe("POST");
		expect(JSON.parse(String(request.body))).toMatchObject({
			local_folder_id: "src-123",
			connector_type: "folder",
			is_final_batch: true,
		});
	});

	test("does not upload when there are no changes", async () => {
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ status: "ok", chunks_indexed: 1 }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const { syncLocalSource } = await import(
			"../../src/services/local/sync.ts"
		);
		const source = {
			local_folder_id: "src-123",
			display_name: "Demo",
			path: tempDir,
			detected_type: "folder",
			cursor: {},
		};

		await syncLocalSource(source);
		mockFetch.mockClear();

		const second = await syncLocalSource(source);
		expect(second.status).toBe("success");
		expect(second.added).toBe(0);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	test("resets mismatched folder cursor root path", async () => {
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ status: "ok", chunks_indexed: 1 }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const { syncLocalSource } = await import(
			"../../src/services/local/sync.ts"
		);
		const source = {
			local_folder_id: "src-123",
			display_name: "Demo",
			path: tempDir,
			detected_type: "folder",
			cursor: {
				last_mtime: 100,
				last_path: "old.ts",
				cursor_version: 1,
				root_path: "/tmp/other",
			},
		};

		await syncLocalSource(source);

		const [, request] = mockFetch.mock.calls[0] as [string, RequestInit];
		expect(JSON.parse(String(request.body)).cursor.root_path).toBe(tempDir);
	});
});
