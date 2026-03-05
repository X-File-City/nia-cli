import { password } from "@crustjs/prompts";
import { V2ApiService } from "nia-ai-ts";
import { app } from "../app.ts";
import {
	configStore,
	getConfigDirPath,
	maskApiKey,
} from "../services/config.ts";
import { configureOpenApi } from "../services/sdk.ts";
import { withErrorHandling } from "../utils/errors.ts";

const loginCommand = app
	.sub("login")
	.meta({ description: "Authenticate with the Nia platform" })
	.flags({
		"api-key": {
			type: "string",
			description: "API key (for non-interactive/CI use)",
		},
	})
	.run(async ({ flags }) => {
		let apiKey = flags["api-key"];

		if (!apiKey) {
			if (!process.stdout.isTTY) {
				console.error("Non-interactive mode requires --api-key <value>");
				console.error("Example: nia auth login --api-key nia_your_api_key");
				process.exit(1);
			}

			apiKey = await password({
				message: "Enter your Nia API key:",
			});

			if (!apiKey) {
				console.error("No API key provided. Aborting.");
				process.exit(1);
			}
		}

		// Validate the API key by calling the usage endpoint
		configureOpenApi(apiKey);

		await withErrorHandling({ domain: "Authentication" }, async () => {
			const usage = await V2ApiService.getUsageSummaryV2V2UsageGet();

			// API key is valid — store it in config
			await configStore.update((config) => ({
				...config,
				apiKey: apiKey,
			}));

			console.log(`Authenticated successfully. API key: ${maskApiKey(apiKey)}`);

			if (usage.subscription_tier) {
				console.log(`Plan: ${usage.subscription_tier}`);
			}

			if (usage.usage) {
				const entries = Object.entries(usage.usage);
				for (const [name, entry] of entries) {
					if (entry.unlimited) {
						console.log(`  ${name}: unlimited`);
					} else if (entry.limit != null && entry.used != null) {
						console.log(`  ${name}: ${entry.used}/${entry.limit}`);
					}
				}
			}
		});
	});

const logoutCommand = app
	.sub("logout")
	.meta({ description: "Remove stored API credentials" })
	.run(async () => {
		await configStore.update((config) => ({
			...config,
			apiKey: undefined,
		}));

		const configPath = `${getConfigDirPath()}/config.json`;
		console.log(`Logged out. API key removed from ${configPath}`);

		if (process.env.NIA_API_KEY) {
			console.log("Note: NIA_API_KEY environment variable is still set.");
		}
	});

const statusCommand = app
	.sub("status")
	.meta({ description: "Check authentication status" })
	.run(async () => {
		// Determine the API key source and value
		const envKey = process.env.NIA_API_KEY;
		const config = await configStore.read();
		const configKey = config.apiKey;

		let source: "env" | "config" | "none";
		let activeKey: string | undefined;

		if (envKey) {
			source = "env";
			activeKey = envKey;
		} else if (configKey) {
			source = "config";
			activeKey = configKey;
		} else {
			source = "none";
			activeKey = undefined;
		}

		if (!activeKey) {
			console.log("Authenticated: no");
			console.log("API key source: none");
			console.log("Run `nia auth login` to authenticate.");
			return;
		}

		console.log("Authenticated: yes");
		console.log(`API key source: ${source}`);
		console.log(`API key: ${maskApiKey(activeKey)}`);

		// Try to fetch plan info
		configureOpenApi(activeKey);

		try {
			const usage = await V2ApiService.getUsageSummaryV2V2UsageGet();

			if (usage.subscription_tier) {
				console.log(`Plan: ${usage.subscription_tier}`);
			}

			if (usage.usage) {
				const entries = Object.entries(usage.usage);
				for (const [name, entry] of entries) {
					if (entry.unlimited) {
						console.log(`  ${name}: unlimited`);
					} else if (entry.limit != null && entry.used != null) {
						console.log(`  ${name}: ${entry.used}/${entry.limit}`);
					}
				}
			}
		} catch {
			console.log("Could not fetch plan info (API key may be invalid).");
		}
	});

/**
 * Resolve the source of the currently active API key.
 * Exported for testing.
 */
export function resolveApiKeySource(
	envKey?: string,
	configKey?: string,
): "env" | "config" | "none" {
	if (envKey) return "env";
	if (configKey) return "config";
	return "none";
}

export const authCommand = app
	.sub("auth")
	.meta({ description: "Authenticate with the Nia platform" })
	.command(loginCommand)
	.command(logoutCommand)
	.command(statusCommand);
