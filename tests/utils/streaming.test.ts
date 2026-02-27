import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { renderStream, renderStreamEvent } from "../../src/utils/streaming.ts";

describe("streaming utilities", () => {
	let logOutput: string[];
	let writeOutput: string[];
	let originalLog: typeof console.log;
	let originalWrite: typeof process.stdout.write;
	let originalIsTTY: boolean | undefined;

	beforeEach(() => {
		logOutput = [];
		writeOutput = [];
		originalLog = console.log;
		originalWrite = process.stdout.write;
		originalIsTTY = process.stdout.isTTY;

		console.log = ((...args: unknown[]) => {
			logOutput.push(args.map(String).join(" "));
		}) as typeof console.log;

		process.stdout.write = ((chunk: string) => {
			writeOutput.push(chunk);
			return true;
		}) as typeof process.stdout.write;
	});

	afterEach(() => {
		console.log = originalLog;
		process.stdout.write = originalWrite;
		Object.defineProperty(process.stdout, "isTTY", {
			value: originalIsTTY,
			configurable: true,
		});
	});

	// --- renderStreamEvent ---

	describe("renderStreamEvent", () => {
		describe("non-TTY mode", () => {
			beforeEach(() => {
				Object.defineProperty(process.stdout, "isTTY", {
					value: false,
					configurable: true,
				});
			});

			test("outputs event as JSON line when not a TTY", () => {
				renderStreamEvent({ type: "content", data: "hello" });
				expect(logOutput.length).toBe(1);
				const parsed = JSON.parse(logOutput[0]!);
				expect(parsed.type).toBe("content");
				expect(parsed.data).toBe("hello");
			});

			test("outputs complex event as JSON line when not a TTY", () => {
				const event = {
					type: "status",
					message: "Processing",
					progress: 42,
					items: ["a", "b"],
				};
				renderStreamEvent(event);
				expect(logOutput.length).toBe(1);
				const parsed = JSON.parse(logOutput[0]!);
				expect(parsed.type).toBe("status");
				expect(parsed.progress).toBe(42);
				expect(parsed.items).toEqual(["a", "b"]);
			});

			test("does not produce ANSI codes in non-TTY mode", () => {
				renderStreamEvent({ type: "error", content: "failure" });
				expect(logOutput.length).toBe(1);
				// Should be valid JSON with no ANSI codes
				const raw = logOutput[0]!;
				expect(raw).not.toContain("\x1b[");
				JSON.parse(raw); // Should not throw
			});
		});

		describe("TTY mode — content events", () => {
			beforeEach(() => {
				Object.defineProperty(process.stdout, "isTTY", {
					value: true,
					configurable: true,
				});
			});

			test("writes content event text directly via process.stdout.write", () => {
				renderStreamEvent({ type: "content", content: "hello world" });
				expect(writeOutput.join("")).toContain("hello world");
				// content events should not use console.log (no newline)
				expect(logOutput.length).toBe(0);
			});

			test("writes text event text directly via process.stdout.write", () => {
				renderStreamEvent({ type: "text", content: "streaming text" });
				expect(writeOutput.join("")).toContain("streaming text");
				expect(logOutput.length).toBe(0);
			});

			test("writes delta event text directly via process.stdout.write", () => {
				renderStreamEvent({ type: "delta", content: "incremental" });
				expect(writeOutput.join("")).toContain("incremental");
				expect(logOutput.length).toBe(0);
			});
		});

		describe("TTY mode — completion events", () => {
			beforeEach(() => {
				Object.defineProperty(process.stdout, "isTTY", {
					value: true,
					configurable: true,
				});
			});

			test("renders done event with type label", () => {
				renderStreamEvent({ type: "done", content: "Research complete" });
				expect(logOutput.length).toBe(1);
				expect(logOutput[0]).toContain("done");
				expect(logOutput[0]).toContain("Research complete");
			});

			test("renders complete event with type label", () => {
				renderStreamEvent({ type: "complete", content: "Finished" });
				expect(logOutput.length).toBe(1);
				expect(logOutput[0]).toContain("complete");
				expect(logOutput[0]).toContain("Finished");
			});

			test("renders end event with type label", () => {
				renderStreamEvent({ type: "end", content: "Stream ended" });
				expect(logOutput.length).toBe(1);
				expect(logOutput[0]).toContain("end");
				expect(logOutput[0]).toContain("Stream ended");
			});
		});

		describe("TTY mode — error events", () => {
			beforeEach(() => {
				Object.defineProperty(process.stdout, "isTTY", {
					value: true,
					configurable: true,
				});
			});

			test("renders error event with type label", () => {
				renderStreamEvent({ type: "error", content: "Something failed" });
				expect(logOutput.length).toBe(1);
				expect(logOutput[0]).toContain("error");
				expect(logOutput[0]).toContain("Something failed");
			});
		});

		describe("TTY mode — status/metadata events", () => {
			beforeEach(() => {
				Object.defineProperty(process.stdout, "isTTY", {
					value: true,
					configurable: true,
				});
			});

			test("renders thinking event with type label", () => {
				renderStreamEvent({ type: "thinking", content: "Analyzing query..." });
				expect(logOutput.length).toBe(1);
				expect(logOutput[0]).toContain("thinking");
				expect(logOutput[0]).toContain("Analyzing query...");
			});

			test("renders searching event with type label", () => {
				renderStreamEvent({ type: "searching", content: "Searching repos..." });
				expect(logOutput.length).toBe(1);
				expect(logOutput[0]).toContain("searching");
			});

			test("renders reading event with type label", () => {
				renderStreamEvent({ type: "reading", content: "Reading file..." });
				expect(logOutput.length).toBe(1);
				expect(logOutput[0]).toContain("reading");
			});

			test("renders analyzing event with type label", () => {
				renderStreamEvent({ type: "analyzing", content: "Analyzing code..." });
				expect(logOutput.length).toBe(1);
				expect(logOutput[0]).toContain("analyzing");
			});

			test("renders custom event type with default styling", () => {
				renderStreamEvent({ type: "progress", content: "50% done" });
				expect(logOutput.length).toBe(1);
				expect(logOutput[0]).toContain("progress");
				expect(logOutput[0]).toContain("50% done");
			});
		});

		describe("TTY mode — content extraction", () => {
			beforeEach(() => {
				Object.defineProperty(process.stdout, "isTTY", {
					value: true,
					configurable: true,
				});
			});

			test("extracts content from 'content' field", () => {
				renderStreamEvent({ type: "done", content: "from content" });
				expect(logOutput[0]).toContain("from content");
			});

			test("extracts content from 'data' field", () => {
				renderStreamEvent({ type: "done", data: "from data" });
				expect(logOutput[0]).toContain("from data");
			});

			test("extracts content from 'message' field", () => {
				renderStreamEvent({ type: "done", message: "from message" });
				expect(logOutput[0]).toContain("from message");
			});

			test("extracts content from 'text' field", () => {
				renderStreamEvent({ type: "done", text: "from text" });
				expect(logOutput[0]).toContain("from text");
			});

			test("extracts content from 'result' field", () => {
				renderStreamEvent({ type: "done", result: "from result" });
				expect(logOutput[0]).toContain("from result");
			});

			test("prefers 'content' over 'data'", () => {
				renderStreamEvent({
					type: "done",
					content: "preferred",
					data: "not this",
				});
				expect(logOutput[0]).toContain("preferred");
			});

			test("JSON-stringifies non-string content fields", () => {
				renderStreamEvent({
					type: "done",
					content: { nested: "object" },
				});
				expect(logOutput[0]).toContain("nested");
				expect(logOutput[0]).toContain("object");
			});

			test("stringifies remaining fields when no known content field", () => {
				renderStreamEvent({
					type: "status",
					progress: 50,
					stage: "indexing",
				});
				expect(logOutput[0]).toContain("progress");
				expect(logOutput[0]).toContain("50");
				expect(logOutput[0]).toContain("indexing");
			});

			test("does not render event with no extractable content", () => {
				renderStreamEvent({ type: "heartbeat" });
				// No content extracted, nothing rendered
				expect(logOutput.length).toBe(0);
				expect(writeOutput.length).toBe(0);
			});
		});

		describe("TTY mode — color option", () => {
			beforeEach(() => {
				Object.defineProperty(process.stdout, "isTTY", {
					value: true,
					configurable: true,
				});
			});

			test("renders with color disabled", () => {
				renderStreamEvent({ type: "error", content: "failure" }, { color: false });
				expect(logOutput.length).toBe(1);
				// Should contain the content but without ANSI codes
				expect(logOutput[0]).toContain("failure");
			});

			test("renders with color enabled (default)", () => {
				renderStreamEvent({ type: "error", content: "failure" });
				expect(logOutput.length).toBe(1);
				expect(logOutput[0]).toContain("failure");
			});
		});

		describe("event type field detection", () => {
			beforeEach(() => {
				Object.defineProperty(process.stdout, "isTTY", {
					value: true,
					configurable: true,
				});
			});

			test("uses 'type' field for event type", () => {
				renderStreamEvent({ type: "done", content: "ok" });
				expect(logOutput[0]).toContain("done");
			});

			test("falls back to 'event' field for event type", () => {
				renderStreamEvent({ event: "done", content: "ok" });
				expect(logOutput[0]).toContain("done");
			});

			test("defaults to 'data' when no type or event field", () => {
				renderStreamEvent({ content: "raw data" });
				// Should use "data" as default event type
				// "data" is not a streaming text type, so it should use console.log
				expect(logOutput.length).toBe(1);
				expect(logOutput[0]).toContain("data");
				expect(logOutput[0]).toContain("raw data");
			});
		});
	});

	// --- renderStream ---

	describe("renderStream", () => {
		test("renders all events from async iterable", async () => {
			Object.defineProperty(process.stdout, "isTTY", {
				value: false,
				configurable: true,
			});

			async function* mockStream() {
				yield { type: "thinking", content: "Starting..." };
				yield { type: "content", data: "Result data" };
				yield { type: "done", content: "Complete" };
			}

			await renderStream(mockStream());
			expect(logOutput.length).toBe(3);

			const first = JSON.parse(logOutput[0]!);
			expect(first.type).toBe("thinking");

			const second = JSON.parse(logOutput[1]!);
			expect(second.type).toBe("content");

			const third = JSON.parse(logOutput[2]!);
			expect(third.type).toBe("done");
		});

		test("handles empty async iterable", async () => {
			Object.defineProperty(process.stdout, "isTTY", {
				value: false,
				configurable: true,
			});

			async function* emptyStream() {
				// yields nothing
			}

			await renderStream(emptyStream());
			expect(logOutput.length).toBe(0);
		});

		test("renders TTY stream events progressively", async () => {
			Object.defineProperty(process.stdout, "isTTY", {
				value: true,
				configurable: true,
			});

			async function* mockStream() {
				yield { type: "content", content: "chunk1" };
				yield { type: "content", content: "chunk2" };
				yield { type: "done", content: "Finished" };
			}

			await renderStream(mockStream());

			// Content chunks go to stdout.write
			const written = writeOutput.join("");
			expect(written).toContain("chunk1");
			expect(written).toContain("chunk2");

			// Done event goes to console.log
			expect(logOutput.length).toBe(1);
			expect(logOutput[0]).toContain("done");
			expect(logOutput[0]).toContain("Finished");
		});

		test("passes options to renderStreamEvent", async () => {
			Object.defineProperty(process.stdout, "isTTY", {
				value: true,
				configurable: true,
			});

			async function* mockStream() {
				yield { type: "error", content: "failure" };
			}

			await renderStream(mockStream(), { color: false });

			expect(logOutput.length).toBe(1);
			expect(logOutput[0]).toContain("failure");
		});

		test("handles stream with mixed event types", async () => {
			Object.defineProperty(process.stdout, "isTTY", {
				value: true,
				configurable: true,
			});

			async function* mockStream() {
				yield { type: "thinking", content: "Thinking..." };
				yield { type: "searching", content: "Searching repos..." };
				yield { type: "content", content: "Found result" };
				yield { type: "error", content: "Warning: partial" };
				yield { type: "done", content: "Complete" };
			}

			await renderStream(mockStream());

			// thinking + searching + error + done = 4 console.log calls
			expect(logOutput.length).toBe(4);

			// content goes to stdout.write
			expect(writeOutput.join("")).toContain("Found result");
		});

		test("renders single-event stream", async () => {
			Object.defineProperty(process.stdout, "isTTY", {
				value: false,
				configurable: true,
			});

			async function* singleEventStream() {
				yield { type: "result", data: "answer" };
			}

			await renderStream(singleEventStream());
			expect(logOutput.length).toBe(1);
			const parsed = JSON.parse(logOutput[0]!);
			expect(parsed.data).toBe("answer");
		});
	});
});
