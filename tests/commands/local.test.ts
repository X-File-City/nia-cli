import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	buildLocalSourceStatuses,
	resolveLocalSource,
} from "../../src/commands/local.ts";

describe("local commands helpers", () => {
	let tempDir: string | undefined;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("resolveLocalSource accepts exact id and unique prefix", () => {
		const sources = [
			{ local_folder_id: "abc12345", display_name: "One" },
			{ local_folder_id: "def67890", display_name: "Two" },
		];

		expect(resolveLocalSource(sources, "abc12345").display_name).toBe("One");
		expect(resolveLocalSource(sources, "def6").display_name).toBe("Two");
	});

	test("resolveLocalSource rejects ambiguous prefixes", () => {
		const sources = [
			{ local_folder_id: "abc12345", display_name: "One" },
			{ local_folder_id: "abc67890", display_name: "Two" },
		];

		expect(() => resolveLocalSource(sources, "abc")).toThrow("Ambiguous");
	});

	test("buildLocalSourceStatuses maps ready and needs_link states", () => {
		tempDir = path.join(os.tmpdir(), `nia-local-status-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });

		const rows = buildLocalSourceStatuses([
			{
				local_folder_id: "src-1",
				display_name: "Linked",
				path: tempDir,
				detected_type: "folder",
			},
			{
				local_folder_id: "src-2",
				display_name: "Unlinked",
				path: "",
				detected_type: "folder",
			},
		]);

		expect(rows).toEqual([
			expect.objectContaining({ id: "src-1", status: "ready" }),
			expect.objectContaining({ id: "src-2", status: "needs_link" }),
		]);
	});
});
