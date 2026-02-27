import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { stripAnsi } from "@crustjs/style";
import {
	createFormatter,
	Formatter,
	resolveOutputFormat,
	truncate,
} from "../../src/utils/formatter.ts";

describe("resolveOutputFormat", () => {
	test("returns 'json' when explicit output is 'json'", () => {
		expect(resolveOutputFormat("json")).toBe("json");
	});

	test("returns 'table' when explicit output is 'table'", () => {
		expect(resolveOutputFormat("table")).toBe("table");
	});

	test("returns 'text' when explicit output is 'text'", () => {
		expect(resolveOutputFormat("text")).toBe("text");
	});

	test("is case-insensitive for explicit format", () => {
		expect(resolveOutputFormat("JSON")).toBe("json");
		expect(resolveOutputFormat("Table")).toBe("table");
		expect(resolveOutputFormat("TEXT")).toBe("text");
	});

	test("defaults to 'json' when no format specified and not TTY", () => {
		const origIsTTY = process.stdout.isTTY;
		Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
		try {
			expect(resolveOutputFormat()).toBe("json");
		} finally {
			Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true });
		}
	});

	test("defaults to 'text' when no format specified and is TTY", () => {
		const origIsTTY = process.stdout.isTTY;
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
		try {
			expect(resolveOutputFormat()).toBe("text");
		} finally {
			Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true });
		}
	});

	test("falls through to auto-detection for invalid format", () => {
		const origIsTTY = process.stdout.isTTY;
		Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
		try {
			expect(resolveOutputFormat("invalid")).toBe("json");
		} finally {
			Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true });
		}
	});
});

describe("truncate", () => {
	test("returns original string when shorter than max", () => {
		expect(truncate("hello", 10)).toBe("hello");
	});

	test("returns original string when equal to max", () => {
		expect(truncate("hello", 5)).toBe("hello");
	});

	test("truncates with ellipsis when longer than max", () => {
		expect(truncate("hello world", 8)).toBe("hello...");
	});

	test("handles very short maxLength", () => {
		expect(truncate("hello", 2)).toBe("he");
	});

	test("handles maxLength of 3", () => {
		// maxLength <= 3 slices without ellipsis to avoid "..." being the entire output
		expect(truncate("hello", 3)).toBe("hel");
	});
});

describe("Formatter", () => {
	// Use color: false consistently to get predictable output without ANSI codes
	const formatter = new Formatter({ output: "text", color: false });

	describe("formatJson", () => {
		test("formats primitives as JSON", () => {
			expect(formatter.formatJson("hello")).toBe('"hello"');
			expect(formatter.formatJson(42)).toBe("42");
			expect(formatter.formatJson(true)).toBe("true");
			expect(formatter.formatJson(null)).toBe("null");
		});

		test("formats objects with 2-space indentation", () => {
			const result = formatter.formatJson({ name: "test", count: 3 });
			expect(result).toBe('{\n  "name": "test",\n  "count": 3\n}');
		});

		test("formats arrays with 2-space indentation", () => {
			const result = formatter.formatJson([1, 2, 3]);
			expect(result).toBe("[\n  1,\n  2,\n  3\n]");
		});

		test("formats nested structures", () => {
			const data = { items: [{ id: "1", name: "a" }] };
			const result = formatter.formatJson(data);
			const parsed = JSON.parse(result);
			expect(parsed.items[0].id).toBe("1");
		});
	});

	describe("formatTable", () => {
		test("returns empty message for empty rows", () => {
			const result = formatter.formatTable([]);
			expect(result).toBe("(no results)");
		});

		test("returns empty message for rows with no columns", () => {
			const result = formatter.formatTable([{}]);
			expect(result).toBe("(no columns)");
		});

		test("renders a table with auto-detected columns", () => {
			const rows = [
				{ name: "Alice", age: "30" },
				{ name: "Bob", age: "25" },
			];
			const result = formatter.formatTable(rows);
			const plain = stripAnsi(result);

			// Should contain header and data
			expect(plain).toContain("Name");
			expect(plain).toContain("Age");
			expect(plain).toContain("Alice");
			expect(plain).toContain("Bob");
			expect(plain).toContain("30");
			expect(plain).toContain("25");
		});

		test("uses explicit columns when provided", () => {
			const rows = [{ name: "Alice", age: "30", email: "alice@test.com" }];
			const result = formatter.formatTable(rows, ["name", "email"]);
			const plain = stripAnsi(result);

			expect(plain).toContain("Name");
			expect(plain).toContain("Email");
			expect(plain).toContain("Alice");
			expect(plain).toContain("alice@test.com");
			// 'age' column should NOT be in output
			expect(plain).not.toContain("Age");
		});

		test("truncates long cell values", () => {
			const longValue = "a".repeat(100);
			const rows = [{ value: longValue }];
			const result = formatter.formatTable(rows);
			const plain = stripAnsi(result);

			// The cell value should be truncated (MAX_CELL_WIDTH is 60)
			// The table itself has borders, headers, and separators adding to total length
			expect(plain).toContain("...");
			// The actual cell content should not contain the full 100 chars
			expect(plain).not.toContain("a".repeat(61));
		});

		test("capitalizes column headers", () => {
			const rows = [{ firstName: "Alice" }];
			const result = formatter.formatTable(rows);
			const plain = stripAnsi(result);

			// camelCase should be split: "firstName" → "First Name"
			expect(plain).toContain("First Name");
		});
	});

	describe("formatText", () => {
		test("formats null as (none)", () => {
			const result = formatter.formatText(null);
			expect(result).toBe("(none)");
		});

		test("formats undefined as (none)", () => {
			const result = formatter.formatText(undefined);
			expect(result).toBe("(none)");
		});

		test("formats strings directly", () => {
			expect(formatter.formatText("hello")).toBe("hello");
		});

		test("formats numbers directly", () => {
			expect(formatter.formatText(42)).toBe("42");
		});

		test("formats booleans directly", () => {
			expect(formatter.formatText(true)).toBe("true");
		});

		test("formats empty array as (empty)", () => {
			expect(formatter.formatText([])).toBe("(empty)");
		});

		test("formats array of primitives as bulleted list", () => {
			const result = formatter.formatText(["a", "b", "c"]);
			expect(result).toBe("- a\n- b\n- c");
		});

		test("formats empty object as (empty)", () => {
			expect(formatter.formatText({})).toBe("(empty)");
		});

		test("formats flat object with key-value pairs", () => {
			const result = formatter.formatText({ name: "test", count: 3 });
			const plain = stripAnsi(result);
			expect(plain).toContain("name: test");
			expect(plain).toContain("count: 3");
		});

		test("formats nested objects with indentation", () => {
			const result = formatter.formatText({ outer: { inner: "value" } });
			const plain = stripAnsi(result);
			expect(plain).toContain("outer:");
			expect(plain).toContain("inner: value");
		});

		test("respects indent parameter", () => {
			const result = formatter.formatText("hello", 2);
			expect(result).toBe("    hello");
		});
	});

	describe("formatList", () => {
		test("returns empty message for empty items", () => {
			const result = formatter.formatList([]);
			expect(result).toBe("(no items)");
		});

		test("formats items with id, name, and optional status", () => {
			const items = [
				{ id: "abc123", name: "My Source", status: "ready" },
				{ id: "def456", name: "Another", status: "failed" },
				{ id: "ghi789", name: "No Status" },
			];
			const result = formatter.formatList(items);
			const plain = stripAnsi(result);

			expect(plain).toContain("abc123");
			expect(plain).toContain("My Source");
			expect(plain).toContain("ready");
			expect(plain).toContain("def456");
			expect(plain).toContain("Another");
			expect(plain).toContain("failed");
			expect(plain).toContain("ghi789");
			expect(plain).toContain("No Status");
		});

		test("truncates long IDs", () => {
			const items = [{ id: "very-long-identifier-value-here", name: "Test" }];
			const result = formatter.formatList(items);
			const plain = stripAnsi(result);

			// ID should be truncated to 12 chars
			expect(plain).toContain("very-long...");
		});
	});
});

describe("createFormatter", () => {
	test("returns a Formatter instance", () => {
		const fmt = createFormatter();
		expect(fmt).toBeInstanceOf(Formatter);
	});

	test("respects explicit output format", () => {
		const fmt = createFormatter({ output: "json" });
		expect(fmt.format).toBe("json");
	});

	test("respects color option", () => {
		const fmt = createFormatter({ color: false });
		expect(fmt.style.enabled).toBe(false);
	});
});

describe("Formatter output method", () => {
	let logOutput: string[];
	const originalLog = console.log;

	beforeEach(() => {
		logOutput = [];
		console.log = (...args: unknown[]) => {
			logOutput.push(args.map(String).join(" "));
		};
	});

	afterEach(() => {
		console.log = originalLog;
	});

	test("outputs JSON when format is json", () => {
		const fmt = new Formatter({ output: "json", color: false });
		fmt.output({ name: "test" });
		expect(logOutput.length).toBe(1);
		const parsed = JSON.parse(logOutput[0]!);
		expect(parsed.name).toBe("test");
	});

	test("outputs text when format is text", () => {
		const fmt = new Formatter({ output: "text", color: false });
		fmt.output({ name: "test" });
		expect(logOutput.length).toBe(1);
		expect(logOutput[0]).toContain("name");
		expect(logOutput[0]).toContain("test");
	});

	test("outputs table when format is table", () => {
		const fmt = new Formatter({ output: "table", color: false });
		fmt.output([{ name: "Alice", age: "30" }]);
		expect(logOutput.length).toBe(1);
		const plain = stripAnsi(logOutput[0]!);
		expect(plain).toContain("Alice");
	});

	test("wraps single object in array for table format", () => {
		const fmt = new Formatter({ output: "table", color: false });
		fmt.output({ name: "single" });
		expect(logOutput.length).toBe(1);
		const plain = stripAnsi(logOutput[0]!);
		expect(plain).toContain("single");
	});
});

describe("Formatter convenience methods", () => {
	let logOutput: string[];
	let errOutput: string[];
	const originalLog = console.log;
	const originalError = console.error;

	beforeEach(() => {
		logOutput = [];
		errOutput = [];
		console.log = (...args: unknown[]) => {
			logOutput.push(args.map(String).join(" "));
		};
		console.error = (...args: unknown[]) => {
			errOutput.push(args.map(String).join(" "));
		};
	});

	afterEach(() => {
		console.log = originalLog;
		console.error = originalError;
	});

	test("success writes to stdout", () => {
		const fmt = new Formatter({ color: false });
		fmt.success("done");
		expect(logOutput[0]).toBe("done");
	});

	test("warn writes to stderr", () => {
		const fmt = new Formatter({ color: false });
		fmt.warn("warning");
		expect(errOutput[0]).toBe("warning");
	});

	test("error writes to stderr", () => {
		const fmt = new Formatter({ color: false });
		fmt.error("failure");
		expect(errOutput[0]).toBe("failure");
	});

	test("info writes to stdout", () => {
		const fmt = new Formatter({ color: false });
		fmt.info("note");
		expect(logOutput[0]).toBe("note");
	});
});
