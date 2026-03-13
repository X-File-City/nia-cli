import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const handlers = new Map<string, () => void>();
const closeWatcher = mock(() => Promise.resolve());
const mockWatch = mock(() => ({
	on: (event: string, handler: () => void) => {
		handlers.set(event, handler);
		return undefined;
	},
	close: closeWatcher,
}));

mock.module("chokidar", () => ({
	default: {
		watch: mockWatch,
	},
	watch: mockWatch,
}));

describe("local watcher", () => {
	beforeEach(() => {
		mockWatch.mockClear();
		closeWatcher.mockClear();
		handlers.clear();
	});

	afterEach(() => {
		handlers.clear();
	});

	test("debounces repeated file events into one callback", async () => {
		const seen: string[] = [];
		const { LocalFolderWatcher } = await import(
			"../../src/services/local/watcher.ts"
		);

		const watcher = new LocalFolderWatcher(20);
		watcher.watch("src-123", "/tmp/demo", (sourceId) => {
			seen.push(sourceId);
		});

		handlers.get("add")?.();
		handlers.get("change")?.();
		handlers.get("unlink")?.();

		await Bun.sleep(40);
		expect(seen).toEqual(["src-123"]);
		await watcher.stop();
	});
});
