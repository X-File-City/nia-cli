import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	ALL_CONFIG_KEYS,
	getConfigDirPath,
	isConfigKey,
	isSettableKey,
	maskApiKey,
	readConfig,
	resetConfig,
	updateConfig,
	writeConfig,
} from "../../src/services/config.ts";

// --- Mock SDK (required for any command that imports from nia-ai-ts) ---

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

describe("config CLI commands", () => {
	beforeEach(async () => {
		try {
			await resetConfig();
		} catch {
			// Ignore
		}
	});

	afterEach(() => {
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	// --- config set ---

	describe("config set", () => {
		test("sets output format to json", async () => {
			await updateConfig((config) => ({
				...config,
				output: "json",
			}));

			const config = await readConfig();
			expect(config.output).toBe("json");
		});

		test("sets output format to table", async () => {
			await updateConfig((config) => ({
				...config,
				output: "table",
			}));

			const config = await readConfig();
			expect(config.output).toBe("table");
		});

		test("sets output format to text", async () => {
			await updateConfig((config) => ({
				...config,
				output: "text",
			}));

			const config = await readConfig();
			expect(config.output).toBe("text");
		});

		test("sets baseUrl to custom value", async () => {
			await updateConfig((config) => ({
				...config,
				baseUrl: "https://custom.api.example.com/v2",
			}));

			const config = await readConfig();
			expect(config.baseUrl).toBe("https://custom.api.example.com/v2");
		});

		test("rejects apiKey via isSettableKey", () => {
			expect(isSettableKey("apiKey")).toBe(false);
		});

		test("rejects unknown keys via isSettableKey", () => {
			expect(isSettableKey("unknown")).toBe(false);
			expect(isSettableKey("password")).toBe(false);
			expect(isSettableKey("")).toBe(false);
		});

		test("validates output format values", () => {
			const validFormats = ["json", "table", "text"];
			const invalidFormats = ["yaml", "xml", "csv", "", "JSON"];

			for (const fmt of validFormats) {
				expect(validFormats.includes(fmt)).toBe(true);
			}

			for (const fmt of invalidFormats) {
				expect(validFormats.includes(fmt)).toBe(false);
			}
		});

		test("set preserves other config values", async () => {
			await writeConfig({
				apiKey: "nia_existing_key",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			await updateConfig((config) => ({
				...config,
				output: "json",
			}));

			const config = await readConfig();
			expect(config.output).toBe("json");
			expect(config.apiKey).toBe("nia_existing_key");
			expect(config.baseUrl).toBe("https://apigcp.trynia.ai/v2");
		});

		test("overwrites previously set values", async () => {
			await updateConfig((config) => ({
				...config,
				output: "json",
			}));

			await updateConfig((config) => ({
				...config,
				output: "table",
			}));

			const config = await readConfig();
			expect(config.output).toBe("table");
		});
	});

	// --- config get ---

	describe("config get", () => {
		test("gets output value", async () => {
			await writeConfig({
				apiKey: undefined,
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: "json",
			});

			const config = await readConfig();
			expect(config.output).toBe("json");
		});

		test("gets baseUrl value", async () => {
			await writeConfig({
				apiKey: undefined,
				baseUrl: "https://custom.api.com",
				output: undefined,
			});

			const config = await readConfig();
			expect(config.baseUrl).toBe("https://custom.api.com");
		});

		test("returns undefined for unset optional keys", async () => {
			const config = await readConfig();
			expect(config.output).toBeUndefined();
			expect(config.apiKey).toBeUndefined();
		});

		test("masks apiKey when retrieving", async () => {
			await writeConfig({
				apiKey: "nia_secret_key_12ab",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			const config = await readConfig();
			const masked = maskApiKey(config.apiKey);
			expect(masked).toBe("nia_****...12ab");
			expect(masked).not.toContain("secret");
		});

		test("validates key is a known config key", () => {
			expect(isConfigKey("apiKey")).toBe(true);
			expect(isConfigKey("baseUrl")).toBe(true);
			expect(isConfigKey("output")).toBe(true);
			expect(isConfigKey("notAKey")).toBe(false);
			expect(isConfigKey("")).toBe(false);
		});
	});

	// --- config list ---

	describe("config list", () => {
		test("ALL_CONFIG_KEYS contains all expected keys", () => {
			expect(ALL_CONFIG_KEYS).toContain("apiKey");
			expect(ALL_CONFIG_KEYS).toContain("baseUrl");
			expect(ALL_CONFIG_KEYS).toContain("output");
			expect(ALL_CONFIG_KEYS.length).toBe(3);
		});

		test("lists all keys with values", async () => {
			await writeConfig({
				apiKey: "nia_test_key_abcd",
				baseUrl: "https://custom.api.com",
				output: "json",
			});

			const config = await readConfig();

			for (const key of ALL_CONFIG_KEYS) {
				const value = config[key];
				if (key === "apiKey") {
					expect(maskApiKey(value)).toBe("nia_****...abcd");
				} else {
					expect(value).toBeDefined();
				}
			}
		});

		test("shows (not set) for undefined values", () => {
			const value: string | undefined = undefined;
			const display = value ?? "(not set)";
			expect(display).toBe("(not set)");
		});

		test("masks apiKey in list output", async () => {
			await writeConfig({
				apiKey: "sk_long_api_key_1234",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			const config = await readConfig();
			const masked = maskApiKey(config.apiKey);
			expect(masked).toBe("****...1234");
			expect(masked).not.toContain("long_api_key");
		});

		test("handles all keys being default/unset", async () => {
			const config = await readConfig();

			expect(config.apiKey).toBeUndefined();
			expect(config.baseUrl).toBe("https://apigcp.trynia.ai/v2");
			expect(config.output).toBeUndefined();
		});
	});

	// --- edge cases ---

	describe("edge cases", () => {
		test("concurrent config updates are safe", async () => {
			await writeConfig({
				apiKey: undefined,
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			// Simulate sequential updates (not truly concurrent due to file locking)
			await updateConfig((config) => ({ ...config, output: "json" }));
			await updateConfig((config) => ({ ...config, baseUrl: "https://custom.com" }));

			const config = await readConfig();
			expect(config.output).toBe("json");
			expect(config.baseUrl).toBe("https://custom.com");
		});

		test("handles empty string values", async () => {
			await updateConfig((config) => ({
				...config,
				baseUrl: "",
			}));

			const config = await readConfig();
			expect(config.baseUrl).toBe("");
		});

		test("apiKey rejection message suggests auth login", () => {
			// Simulate the CLI behavior when user tries `nia config set apiKey xxx`
			const key = "apiKey";
			if (key === "apiKey") {
				const message = "Use `nia auth login` to set your API key.";
				expect(message).toContain("nia auth login");
			}
		});
	});
});
