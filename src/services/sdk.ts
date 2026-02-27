import { NiaSDK, OpenAPI } from "nia-ai-ts";
import { resolveApiKey, resolveBaseUrl } from "./config.ts";

export interface CreateSdkOptions {
	/** CLI --api-key flag override */
	apiKey?: string;
	/** CLI or config base URL override */
	baseUrl?: string;
}

/**
 * Create and configure a NiaSDK instance using the config resolution chain:
 *   1. Explicit override (from CLI --api-key flag)
 *   2. NIA_API_KEY environment variable
 *   3. Config file (~/.config/nia/config.json)
 *
 * Also configures the OpenAPI singleton for low-level service classes.
 *
 * Throws if no API key is found anywhere in the chain.
 */
export async function createSdk(
	options: CreateSdkOptions = {},
): Promise<NiaSDK> {
	const apiKey = await resolveApiKey(options.apiKey);

	if (!apiKey) {
		throw new Error(
			"No API key found. Run `nia auth login` to authenticate, " +
				"or set the NIA_API_KEY environment variable.",
		);
	}

	const baseUrl = await resolveBaseUrl(options.baseUrl);

	// Configure the OpenAPI singleton for low-level service classes
	// (V2ApiRepositoriesService, V2ApiDataSourcesService, etc.)
	OpenAPI.BASE = baseUrl;
	OpenAPI.TOKEN = apiKey;

	return new NiaSDK({
		apiKey,
		baseUrl,
	});
}

/**
 * Configure the OpenAPI singleton without creating a full SDK instance.
 * Useful for validation calls (e.g., auth login) that only need low-level services.
 */
export function configureOpenApi(apiKey: string, baseUrl?: string): void {
	OpenAPI.BASE = baseUrl ?? "https://apigcp.trynia.ai/v2";
	OpenAPI.TOKEN = apiKey;
}
