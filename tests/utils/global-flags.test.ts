import { describe, expect, test } from "bun:test";
import { parseGlobalFlags } from "../../src/utils/global-flags.ts";

describe("parseGlobalFlags", () => {
	describe("--api-key", () => {
		test("parses --api-key with space-separated value", () => {
			const flags = parseGlobalFlags(["bun", "nia", "--api-key", "nia_test123"]);
			expect(flags.apiKey).toBe("nia_test123");
		});

		test("parses --api-key with = separator", () => {
			const flags = parseGlobalFlags(["bun", "nia", "--api-key=nia_test456"]);
			expect(flags.apiKey).toBe("nia_test456");
		});

		test("returns undefined when --api-key is not present", () => {
			const flags = parseGlobalFlags(["bun", "nia", "search", "universal"]);
			expect(flags.apiKey).toBeUndefined();
		});

		test("does not consume next arg if it starts with -", () => {
			const flags = parseGlobalFlags(["bun", "nia", "--api-key", "--output", "json"]);
			expect(flags.apiKey).toBeUndefined();
			expect(flags.output).toBe("json");
		});

		test("handles --api-key as last arg without value", () => {
			const flags = parseGlobalFlags(["bun", "nia", "--api-key"]);
			expect(flags.apiKey).toBeUndefined();
		});
	});

	describe("--output / -o", () => {
		test("parses --output with space-separated value", () => {
			const flags = parseGlobalFlags(["bun", "nia", "--output", "json"]);
			expect(flags.output).toBe("json");
		});

		test("parses --output with = separator", () => {
			const flags = parseGlobalFlags(["bun", "nia", "--output=table"]);
			expect(flags.output).toBe("table");
		});

		test("parses -o short alias", () => {
			const flags = parseGlobalFlags(["bun", "nia", "-o", "text"]);
			expect(flags.output).toBe("text");
		});

		test("returns undefined when --output is not present", () => {
			const flags = parseGlobalFlags(["bun", "nia", "search"]);
			expect(flags.output).toBeUndefined();
		});

		test("does not consume next arg if it starts with -", () => {
			const flags = parseGlobalFlags(["bun", "nia", "-o", "--verbose"]);
			expect(flags.output).toBeUndefined();
			expect(flags.verbose).toBe(true);
		});
	});

	describe("--verbose", () => {
		test("sets verbose to true when present", () => {
			const flags = parseGlobalFlags(["bun", "nia", "--verbose", "search"]);
			expect(flags.verbose).toBe(true);
		});

		test("verbose is undefined when not present", () => {
			const flags = parseGlobalFlags(["bun", "nia", "search"]);
			expect(flags.verbose).toBeUndefined();
		});

		test("works with other flags", () => {
			const flags = parseGlobalFlags(["bun", "nia", "--verbose", "--output", "json"]);
			expect(flags.verbose).toBe(true);
			expect(flags.output).toBe("json");
		});
	});

	describe("--no-color", () => {
		test("sets color to false when --no-color is present", () => {
			const flags = parseGlobalFlags(["bun", "nia", "--no-color", "search"]);
			expect(flags.color).toBe(false);
		});

		test("color is undefined when --no-color is not present", () => {
			const flags = parseGlobalFlags(["bun", "nia", "search"]);
			expect(flags.color).toBeUndefined();
		});
	});

	describe("combined flags", () => {
		test("parses all flags at once", () => {
			const flags = parseGlobalFlags([
				"bun",
				"nia",
				"--api-key",
				"nia_abc",
				"--output",
				"json",
				"--verbose",
				"--no-color",
				"search",
				"universal",
				"my query",
			]);
			expect(flags.apiKey).toBe("nia_abc");
			expect(flags.output).toBe("json");
			expect(flags.verbose).toBe(true);
			expect(flags.color).toBe(false);
		});

		test("handles flags mixed with subcommand args", () => {
			const flags = parseGlobalFlags([
				"bun",
				"nia",
				"search",
				"--output=text",
				"universal",
				"--verbose",
				"query here",
			]);
			expect(flags.output).toBe("text");
			expect(flags.verbose).toBe(true);
		});

		test("returns empty object for no matching flags", () => {
			const flags = parseGlobalFlags(["bun", "nia", "search", "universal"]);
			expect(flags.apiKey).toBeUndefined();
			expect(flags.output).toBeUndefined();
			expect(flags.verbose).toBeUndefined();
			expect(flags.color).toBeUndefined();
		});

		test("handles empty argv", () => {
			const flags = parseGlobalFlags([]);
			expect(flags.apiKey).toBeUndefined();
			expect(flags.output).toBeUndefined();
			expect(flags.verbose).toBeUndefined();
			expect(flags.color).toBeUndefined();
		});

		test("defaults to process.argv when no arg provided", () => {
			// Just verify it doesn't throw
			const flags = parseGlobalFlags();
			expect(typeof flags).toBe("object");
		});
	});
});
