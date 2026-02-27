import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	getConfigDirPath,
	resetConfig,
	writeConfig,
} from "../../src/services/config.ts";

// --- Mock @crustjs/prompts ---

const mockInput = mock(() => Promise.resolve("test-input"));
const mockSelect = mock(() => Promise.resolve("documentation"));
const mockConfirm = mock(() => Promise.resolve(true));

mock.module("@crustjs/prompts", () => ({
	input: mockInput,
	select: mockSelect,
	confirm: mockConfirm,
	password: mock(() => Promise.resolve("nia_test_token")),
}));

// Mock nia-ai-ts to prevent import errors
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
}));

// --- Import after mocking ---

import {
	checkFirstRun,
	isTTY,
	promptConfirm,
	promptOptional,
	promptSelect,
	requireArg,
} from "../../src/utils/prompts.ts";

describe("prompts utilities", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}
		mockInput.mockClear();
		mockSelect.mockClear();
		mockConfirm.mockClear();
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	describe("isTTY", () => {
		test("returns a boolean", () => {
			const result = isTTY();
			expect(typeof result).toBe("boolean");
		});
	});

	describe("checkFirstRun", () => {
		test("does not exit when API key override is provided", async () => {
			// Should not throw or exit when an override is given
			await checkFirstRun("nia_override_key");
			// If we reach here, no exit occurred
			expect(true).toBe(true);
		});

		test("does not exit when NIA_API_KEY env var is set", async () => {
			process.env.NIA_API_KEY = "nia_env_key";
			await checkFirstRun();
			expect(true).toBe(true);
			delete process.env.NIA_API_KEY;
		});

		test("does not exit when config file has API key", async () => {
			await writeConfig({
				apiKey: "nia_config_key_1234",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			await checkFirstRun();
			expect(true).toBe(true);
		});

		test("calls process.exit when no API key is found", async () => {
			// Ensure no key is available
			delete process.env.NIA_API_KEY;
			await resetConfig();

			const exitMock = mock(() => {
				throw new Error("process.exit called");
			});
			const originalExit = process.exit;
			process.exit = exitMock as unknown as typeof process.exit;

			try {
				await checkFirstRun();
				// Should not reach here
				expect(true).toBe(false);
			} catch (e) {
				expect((e as Error).message).toBe("process.exit called");
				expect(exitMock).toHaveBeenCalledWith(1);
			} finally {
				process.exit = originalExit;
			}
		});
	});

	describe("requireArg", () => {
		test("returns value directly when provided", async () => {
			const result = await requireArg("https://docs.example.com", {
				name: "url",
				message: "Enter URL:",
			});
			expect(result).toBe("https://docs.example.com");
			expect(mockInput).not.toHaveBeenCalled();
		});

		test("prompts for value when not provided and in TTY", async () => {
			// Only test prompting behavior if we're in a TTY
			// (In CI/test runners, stdout may not be a TTY)
			const tty = !!process.stdout.isTTY;
			if (tty) {
				mockInput.mockImplementationOnce(() =>
					Promise.resolve("https://prompted.com"),
				);

				const result = await requireArg(undefined, {
					name: "url",
					message: "Enter URL:",
				});
				expect(result).toBe("https://prompted.com");
				expect(mockInput).toHaveBeenCalledTimes(1);
			} else {
				// Non-TTY: should exit with error
				const exitMock = mock(() => {
					throw new Error("process.exit called");
				});
				const originalExit = process.exit;
				process.exit = exitMock as unknown as typeof process.exit;

				try {
					await requireArg(undefined, {
						name: "url",
						message: "Enter URL:",
					});
					expect(true).toBe(false);
				} catch (e) {
					expect((e as Error).message).toBe("process.exit called");
					expect(exitMock).toHaveBeenCalledWith(1);
				} finally {
					process.exit = originalExit;
				}
			}
		});

		test("does not prompt when value is a non-empty string", async () => {
			const result = await requireArg("value", {
				name: "test",
				message: "Prompt:",
			});
			expect(result).toBe("value");
			expect(mockInput).not.toHaveBeenCalled();
		});

		test("passes validate function to input prompt", async () => {
			const tty = !!process.stdout.isTTY;
			if (tty) {
				const validateFn = (v: string) => {
					try {
						new URL(v);
						return true as const;
					} catch {
						return "Invalid URL";
					}
				};

				mockInput.mockImplementationOnce(() =>
					Promise.resolve("https://valid.com"),
				);

				await requireArg(undefined, {
					name: "url",
					message: "Enter URL:",
					validate: validateFn,
				});

				expect(mockInput).toHaveBeenCalledWith({
					message: "Enter URL:",
					validate: validateFn,
				});
			}
		});
	});

	describe("promptOptional", () => {
		test("returns undefined when not in TTY", async () => {
			const tty = !!process.stdout.isTTY;
			if (!tty) {
				const result = await promptOptional({ message: "Optional input:" });
				expect(result).toBeUndefined();
				expect(mockInput).not.toHaveBeenCalled();
			}
		});

		test("returns value from prompt when in TTY", async () => {
			const tty = !!process.stdout.isTTY;
			if (tty) {
				mockInput.mockImplementationOnce(() => Promise.resolve("user-input"));
				const result = await promptOptional({ message: "Optional input:" });
				expect(result).toBe("user-input");
				expect(mockInput).toHaveBeenCalledTimes(1);
			}
		});

		test("returns undefined when user provides empty input in TTY", async () => {
			const tty = !!process.stdout.isTTY;
			if (tty) {
				mockInput.mockImplementationOnce(() => Promise.resolve(""));
				const result = await promptOptional({ message: "Optional input:" });
				expect(result).toBeUndefined();
			}
		});
	});

	describe("promptSelect", () => {
		test("returns undefined when not in TTY", async () => {
			const tty = !!process.stdout.isTTY;
			if (!tty) {
				const result = await promptSelect({
					message: "Choose type:",
					choices: [
						{ label: "Documentation", value: "documentation" as const },
						{ label: "Repository", value: "repository" as const },
					],
				});
				expect(result).toBeUndefined();
				expect(mockSelect).not.toHaveBeenCalled();
			}
		});

		test("returns selected value when in TTY", async () => {
			const tty = !!process.stdout.isTTY;
			if (tty) {
				mockSelect.mockImplementationOnce(() => Promise.resolve("repository"));
				const result = await promptSelect({
					message: "Choose type:",
					choices: [
						{ label: "Documentation", value: "documentation" as const },
						{ label: "Repository", value: "repository" as const },
					],
				});
				expect(result).toBe("repository");
				expect(mockSelect).toHaveBeenCalledTimes(1);
			}
		});
	});

	describe("promptConfirm", () => {
		test("returns default value when not in TTY", async () => {
			const tty = !!process.stdout.isTTY;
			if (!tty) {
				const result = await promptConfirm({
					message: "Continue?",
					initial: true,
				});
				expect(result).toBe(true);
				expect(mockConfirm).not.toHaveBeenCalled();
			}
		});

		test("returns false as default when not in TTY and no initial", async () => {
			const tty = !!process.stdout.isTTY;
			if (!tty) {
				const result = await promptConfirm({ message: "Continue?" });
				expect(result).toBe(false);
				expect(mockConfirm).not.toHaveBeenCalled();
			}
		});

		test("prompts user when in TTY", async () => {
			const tty = !!process.stdout.isTTY;
			if (tty) {
				mockConfirm.mockImplementationOnce(() => Promise.resolve(false));
				const result = await promptConfirm({ message: "Continue?" });
				expect(result).toBe(false);
				expect(mockConfirm).toHaveBeenCalledTimes(1);
			}
		});
	});

	describe("interactive mode integration", () => {
		test("requireArg returns provided value without prompting", async () => {
			const url = await requireArg("https://docs.example.com", {
				name: "url",
				message: "URL to index:",
			});

			expect(url).toBe("https://docs.example.com");
			expect(mockInput).not.toHaveBeenCalled();
		});

		test("all prompts are skippable via flags (non-interactive path)", async () => {
			// This verifies that when all args/flags are provided,
			// no prompts are triggered — enabling CI/scripting use
			const url = await requireArg("https://docs.example.com", {
				name: "url",
				message: "URL to index:",
			});
			expect(url).toBe("https://docs.example.com");

			// promptOptional returns undefined in non-TTY
			if (!process.stdout.isTTY) {
				const name = await promptOptional({ message: "Name:" });
				expect(name).toBeUndefined();

				const type = await promptSelect({
					message: "Type:",
					choices: [{ label: "Docs", value: "documentation" as const }],
				});
				expect(type).toBeUndefined();
			}

			expect(mockInput).not.toHaveBeenCalled();
		});

		test("checkFirstRun passes when API key exists in config", async () => {
			await writeConfig({
				apiKey: "nia_test_key_for_firstrun",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			// Should not exit
			await checkFirstRun();
			expect(true).toBe(true);
		});

		test("checkFirstRun passes when API key exists in env", async () => {
			process.env.NIA_API_KEY = "nia_env_key_test";
			await checkFirstRun();
			expect(true).toBe(true);
			delete process.env.NIA_API_KEY;
		});
	});
});
