import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createSpinner } from "../../src/utils/spinner.ts";

describe("spinner utilities", () => {
	let writeOutput: string[];
	let logOutput: string[];
	let originalWrite: typeof process.stdout.write;
	let originalLog: typeof console.log;
	let originalIsTTY: boolean | undefined;

	beforeEach(() => {
		writeOutput = [];
		logOutput = [];
		originalWrite = process.stdout.write;
		originalLog = console.log;
		originalIsTTY = process.stdout.isTTY;

		process.stdout.write = ((chunk: string) => {
			writeOutput.push(chunk);
			return true;
		}) as typeof process.stdout.write;

		console.log = ((...args: unknown[]) => {
			logOutput.push(args.map(String).join(" "));
		}) as typeof console.log;
	});

	afterEach(() => {
		process.stdout.write = originalWrite;
		console.log = originalLog;
		Object.defineProperty(process.stdout, "isTTY", {
			value: originalIsTTY,
			configurable: true,
		});
	});

	describe("non-TTY spinner (no-op)", () => {
		beforeEach(() => {
			Object.defineProperty(process.stdout, "isTTY", {
				value: false,
				configurable: true,
			});
		});

		test("createSpinner returns a spinner object", () => {
			const spinner = createSpinner();
			expect(spinner).toBeDefined();
			expect(typeof spinner.start).toBe("function");
			expect(typeof spinner.update).toBe("function");
			expect(typeof spinner.stop).toBe("function");
		});

		test("start does not produce any output", () => {
			const spinner = createSpinner();
			spinner.start("Loading...");
			expect(writeOutput.length).toBe(0);
			expect(logOutput.length).toBe(0);
		});

		test("update does not produce any output", () => {
			const spinner = createSpinner();
			spinner.start("Loading...");
			spinner.update("Still loading...");
			expect(writeOutput.length).toBe(0);
			expect(logOutput.length).toBe(0);
		});

		test("stop does not produce any output", () => {
			const spinner = createSpinner();
			spinner.start("Loading...");
			spinner.stop("Done");
			expect(writeOutput.length).toBe(0);
			expect(logOutput.length).toBe(0);
		});

		test("no ANSI codes are emitted in non-TTY mode", () => {
			const spinner = createSpinner();
			spinner.start("Loading...");
			spinner.update("Still loading...");
			spinner.stop("Done");
			// No output at all
			const allOutput = [...writeOutput, ...logOutput].join("");
			expect(allOutput).toBe("");
		});
	});

	describe("TTY spinner", () => {
		beforeEach(() => {
			Object.defineProperty(process.stdout, "isTTY", {
				value: true,
				configurable: true,
			});
		});

		test("createSpinner returns a spinner object", () => {
			const spinner = createSpinner();
			expect(spinner).toBeDefined();
			expect(typeof spinner.start).toBe("function");
			expect(typeof spinner.update).toBe("function");
			expect(typeof spinner.stop).toBe("function");
		});

		test("start renders spinner frame and message", () => {
			const spinner = createSpinner({ color: false });
			spinner.start("Loading...");
			// Should have written at least one frame
			const written = writeOutput.join("");
			expect(written).toContain("Loading...");
			// Clean up the interval
			spinner.stop("Done");
		});

		test("stop clears spinner and prints final message", () => {
			const spinner = createSpinner({ color: false });
			spinner.start("Loading...");
			writeOutput = []; // Clear start output
			logOutput = [];
			spinner.stop("Completed!");
			// Should have cleared the line and printed the final message
			expect(logOutput.length).toBe(1);
			expect(logOutput[0]).toContain("Completed!");
		});

		test("stop renders check mark", () => {
			const spinner = createSpinner({ color: false });
			spinner.start("Loading...");
			logOutput = [];
			spinner.stop("Done");
			expect(logOutput[0]).toContain("\u2713"); // ✓ character
		});

		test("update changes the displayed message", () => {
			const spinner = createSpinner({ color: false });
			spinner.start("Step 1...");
			spinner.update("Step 2...");
			// The update changes internal state; wait for a render cycle
			// We can verify by stopping and checking intermediate output
			spinner.stop("Done");
			// The spinner should have used the updated message at some point
			// (We can't reliably test async render, but update shouldn't throw)
			expect(logOutput.length).toBeGreaterThan(0);
		});

		test("calling start twice resets the spinner", () => {
			const spinner = createSpinner({ color: false });
			spinner.start("First");
			spinner.start("Second");
			const written = writeOutput.join("");
			expect(written).toContain("Second");
			spinner.stop("Done");
		});

		test("respects color: false option", () => {
			const spinner = createSpinner({ color: false });
			spinner.start("Loading...");
			spinner.stop("Done");
			// With color: false, the check mark should still appear
			// but without ANSI color codes around "Done" text specifically
			expect(logOutput[0]).toContain("Done");
		});

		test("uses braille characters for animation frames", () => {
			const spinner = createSpinner({ color: false });
			spinner.start("Test");
			const written = writeOutput.join("");
			// Should contain at least one braille frame character
			const brailleChars = [
				"\u280B",
				"\u2819",
				"\u2839",
				"\u2838",
				"\u283C",
				"\u2834",
				"\u2826",
				"\u2827",
				"\u2807",
				"\u280F",
			]; // ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏
			const hasFrame = brailleChars.some((char) => written.includes(char));
			expect(hasFrame).toBe(true);
			spinner.stop("Done");
		});
	});
});
