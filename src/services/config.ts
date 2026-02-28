import { configDir, createStore } from "@crustjs/store";

const CONFIG_APP_NAME = "nia";

const store = createStore({
	dirPath: configDir(CONFIG_APP_NAME),
	name: "config",
	fields: {
		apiKey: {
			type: "string",
			description: "Nia API key (managed via `nia auth login`)",
		},
		baseUrl: {
			type: "string",
			default: "https://apigcp.trynia.ai/v2",
			description: "Nia API base URL",
		},
		output: {
			type: "string",
			description: "Default output format: json, table, text",
		},
	},
});

export type NiaConfig = Awaited<ReturnType<typeof store.read>>;

/**
 * Read the full config, with defaults applied for missing keys.
 */
export async function readConfig(): Promise<NiaConfig> {
	return store.read();
}

/**
 * Write the full config object atomically.
 */
export async function writeConfig(config: NiaConfig): Promise<void> {
	return store.write(config);
}

/**
 * Update a single config value atomically.
 */
export async function updateConfig(
	updater: (current: NiaConfig) => NiaConfig,
): Promise<void> {
	return store.update(updater);
}

/**
 * Reset config to defaults (deletes the config file).
 */
export async function resetConfig(): Promise<void> {
	return store.reset();
}

/**
 * Allowed keys for `nia config set`. The apiKey is intentionally excluded —
 * it must be set via `nia auth login`.
 */
const SETTABLE_KEYS = ["output", "baseUrl"] as const;
type SettableKey = (typeof SETTABLE_KEYS)[number];

/**
 * Check whether a key is allowed to be set via `nia config set`.
 */
export function isSettableKey(key: string): key is SettableKey {
	return (SETTABLE_KEYS as readonly string[]).includes(key);
}

/**
 * All valid config keys (for display/validation).
 */
export const ALL_CONFIG_KEYS = ["apiKey", "baseUrl", "output"] as const;
export type ConfigKey = (typeof ALL_CONFIG_KEYS)[number];

export function isConfigKey(key: string): key is ConfigKey {
	return (ALL_CONFIG_KEYS as readonly string[]).includes(key);
}

/**
 * Mask an API key for display: shows "nia_****…ab12" or "****…ab12".
 * Returns "(not set)" if the key is undefined or empty.
 */
export function maskApiKey(key: string | undefined): string {
	if (!key) {
		return "(not set)";
	}

	const last4 = key.slice(-4);

	if (key.startsWith("nia_")) {
		return `nia_****...${last4}`;
	}

	return `****...${last4}`;
}

/**
 * Resolve the API key from the config resolution chain:
 * 1. Override (from CLI --api-key flag)
 * 2. NIA_API_KEY environment variable
 * 3. Config file (~/.config/nia/config.json)
 *
 * Returns undefined if no key is found anywhere.
 */
export async function resolveApiKey(
	override?: string,
): Promise<string | undefined> {
	if (override) {
		return override;
	}

	const envKey = process.env.NIA_API_KEY;
	if (envKey) {
		return envKey;
	}

	const config = await readConfig();
	return config.apiKey;
}

/**
 * Resolve the base URL from overrides or config.
 */
export async function resolveBaseUrl(override?: string): Promise<string> {
	if (override) {
		return override;
	}

	const config = await readConfig();
	return config.baseUrl;
}

/**
 * Returns the path to the config directory.
 */
export function getConfigDirPath(): string {
	return configDir(CONFIG_APP_NAME);
}
