import { configDir, createStore } from "@crustjs/store";

export const CONFIG_APP_NAME = "nia";
export const DEFAULT_BASE_URL = "https://apigcp.trynia.ai/v2";

export const configStore = createStore({
	dirPath: configDir(CONFIG_APP_NAME),
	name: "config",
	fields: {
		apiKey: {
			type: "string",
			description: "Nia API key (managed via `nia auth login`)",
		},
		baseUrl: {
			type: "string",
			default: DEFAULT_BASE_URL,
			description: "Nia API base URL",
		},
	},
});

export type NiaConfig = Awaited<ReturnType<typeof configStore.read>>;

/**
 * The active config directory path.
 */
export function getConfigDirPath(): string {
	return configDir(CONFIG_APP_NAME);
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

	const config = await configStore.read();
	return config.apiKey;
}

/**
 * Resolve the API base URL from the config resolution chain:
 * 1. Override (from CLI flag)
 * 2. NIA_BASE_URL environment variable
 * 3. Config file (~/.config/nia/config.json)
 *
 * Returns the default URL if no override is found.
 */
export async function resolveBaseUrl(override?: string): Promise<string> {
	if (override) {
		return override;
	}

	const envBaseUrl = process.env.NIA_BASE_URL;
	if (envBaseUrl) {
		return envBaseUrl;
	}

	const config = await configStore.read();
	return config.baseUrl;
}
