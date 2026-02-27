import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import {
	ALL_CONFIG_KEYS,
	getConfigDirPath,
	isConfigKey,
	isSettableKey,
	maskApiKey,
	readConfig,
	resetConfig,
	resolveApiKey,
	resolveBaseUrl,
	updateConfig,
	writeConfig,
} from "../../src/services/config.ts";

describe("config service", () => {
	beforeEach(async () => {
		// Clean the config file before each test
		try {
			await resetConfig();
		} catch {
			// Ignore errors if file doesn't exist
		}
	});

	afterEach(() => {
		// Clean up any leftover config files
		const dir = getConfigDirPath();
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore
		}

		// Clean env vars set by tests
		delete process.env.NIA_API_KEY;
	});

	describe("readConfig", () => {
		test("returns defaults when no config file exists", async () => {
			const config = await readConfig();
			expect(config.apiKey).toBeUndefined();
			expect(config.baseUrl).toBe("https://apigcp.trynia.ai/v2");
			expect(config.output).toBeUndefined();
		});

		test("reads persisted config values", async () => {
			await writeConfig({
				apiKey: "nia_test1234",
				baseUrl: "https://custom.api.com",
				output: "json",
			});

			const config = await readConfig();
			expect(config.apiKey).toBe("nia_test1234");
			expect(config.baseUrl).toBe("https://custom.api.com");
			expect(config.output).toBe("json");
		});
	});

	describe("writeConfig", () => {
		test("persists config and reads it back", async () => {
			await writeConfig({
				apiKey: "nia_abcd",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: "table",
			});

			const config = await readConfig();
			expect(config.apiKey).toBe("nia_abcd");
			expect(config.output).toBe("table");
		});
	});

	describe("updateConfig", () => {
		test("atomically updates a single field", async () => {
			await writeConfig({
				apiKey: undefined,
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			await updateConfig((current) => ({
				...current,
				output: "json",
			}));

			const config = await readConfig();
			expect(config.output).toBe("json");
			expect(config.baseUrl).toBe("https://apigcp.trynia.ai/v2");
		});
	});

	describe("resetConfig", () => {
		test("resets to defaults", async () => {
			await writeConfig({
				apiKey: "nia_secret",
				baseUrl: "https://custom.com",
				output: "json",
			});

			await resetConfig();

			const config = await readConfig();
			expect(config.apiKey).toBeUndefined();
			expect(config.baseUrl).toBe("https://apigcp.trynia.ai/v2");
		});
	});

	describe("maskApiKey", () => {
		test("masks key starting with nia_ prefix", () => {
			expect(maskApiKey("nia_abcdef1234")).toBe("nia_****...1234");
		});

		test("masks key without nia_ prefix", () => {
			expect(maskApiKey("sk-abcdefgh5678")).toBe("****...5678");
		});

		test("returns '(not set)' for undefined", () => {
			expect(maskApiKey(undefined)).toBe("(not set)");
		});

		test("returns '(not set)' for empty string", () => {
			expect(maskApiKey("")).toBe("(not set)");
		});

		test("handles short keys", () => {
			expect(maskApiKey("ab")).toBe("****...ab");
		});
	});

	describe("isSettableKey", () => {
		test("allows 'output' key", () => {
			expect(isSettableKey("output")).toBe(true);
		});

		test("allows 'baseUrl' key", () => {
			expect(isSettableKey("baseUrl")).toBe(true);
		});

		test("rejects 'apiKey' key", () => {
			expect(isSettableKey("apiKey")).toBe(false);
		});

		test("rejects unknown keys", () => {
			expect(isSettableKey("unknown")).toBe(false);
		});
	});

	describe("isConfigKey", () => {
		test("recognizes all valid config keys", () => {
			for (const key of ALL_CONFIG_KEYS) {
				expect(isConfigKey(key)).toBe(true);
			}
		});

		test("rejects unknown keys", () => {
			expect(isConfigKey("notAKey")).toBe(false);
		});
	});

	describe("resolveApiKey", () => {
		test("returns override when provided", async () => {
			process.env.NIA_API_KEY = "env_key";
			await writeConfig({
				apiKey: "config_key",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			const key = await resolveApiKey("override_key");
			expect(key).toBe("override_key");
		});

		test("returns env var when no override", async () => {
			process.env.NIA_API_KEY = "env_key";
			await writeConfig({
				apiKey: "config_key",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			const key = await resolveApiKey();
			expect(key).toBe("env_key");
		});

		test("returns config key when no override or env", async () => {
			delete process.env.NIA_API_KEY;
			await writeConfig({
				apiKey: "config_key",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			const key = await resolveApiKey();
			expect(key).toBe("config_key");
		});

		test("returns undefined when no key found anywhere", async () => {
			delete process.env.NIA_API_KEY;

			const key = await resolveApiKey();
			expect(key).toBeUndefined();
		});

		test("priority: override > env > config", async () => {
			process.env.NIA_API_KEY = "env";
			await writeConfig({
				apiKey: "config",
				baseUrl: "https://apigcp.trynia.ai/v2",
				output: undefined,
			});

			// Override beats env and config
			expect(await resolveApiKey("override")).toBe("override");

			// Env beats config
			expect(await resolveApiKey()).toBe("env");

			// Config used as fallback
			delete process.env.NIA_API_KEY;
			expect(await resolveApiKey()).toBe("config");
		});
	});

	describe("resolveBaseUrl", () => {
		test("returns override when provided", async () => {
			const url = await resolveBaseUrl("https://custom.com");
			expect(url).toBe("https://custom.com");
		});

		test("returns config value when no override", async () => {
			await writeConfig({
				apiKey: undefined,
				baseUrl: "https://configured.com",
				output: undefined,
			});

			const url = await resolveBaseUrl();
			expect(url).toBe("https://configured.com");
		});

		test("returns default when no override or config", async () => {
			const url = await resolveBaseUrl();
			expect(url).toBe("https://apigcp.trynia.ai/v2");
		});
	});

	describe("getConfigDirPath", () => {
		test("returns a path under XDG_CONFIG_HOME", () => {
			const dir = getConfigDirPath();
			expect(dir).toContain("/tmp/nia-cli-test-config");
			expect(dir).toContain("nia");
		});
	});
});
