import { defineCommand } from "@crustjs/core";
import { password } from "@crustjs/prompts";
import { V2ApiService } from "nia-ai-ts";
import {
	getConfigDirPath,
	maskApiKey,
	readConfig,
	updateConfig,
} from "../services/config.ts";
import { configureOpenApi } from "../services/sdk.ts";
import { handleError } from "../utils/errors.ts";

const loginCommand = defineCommand({
	meta: {
		name: "login",
		description: "Authenticate with the Nia platform",
	},
	flags: {
		token: {
			type: "string",
			description: "API token (for non-interactive/CI use)",
		},
	},
	async run({ flags }) {
		let token = flags.token;

		if (!token) {
			if (!process.stdout.isTTY) {
				console.error("Non-interactive mode requires --token <value>");
				console.error("Example: nia auth login --token nia_your_api_token");
				process.exit(1);
			}

			token = await password({
				message: "Enter your Nia API token:",
			});

			if (!token) {
				console.error("No token provided. Aborting.");
				process.exit(1);
			}
		}

		// Validate the token by calling the usage endpoint
		configureOpenApi(token);

		try {
			const usage = await V2ApiService.getUsageSummaryV2V2UsageGet();

			// Token is valid — store it in config
			await updateConfig((config) => ({
				...config,
				apiKey: token,
			}));

			console.log(`Authenticated successfully. Token: ${maskApiKey(token)}`);

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
		} catch (error: unknown) {
			handleError(error, { domain: "Authentication" });
		}
	},
});

const logoutCommand = defineCommand({
	meta: {
		name: "logout",
		description: "Remove stored API credentials",
	},
	async run() {
		await updateConfig((config) => ({
			...config,
			apiKey: undefined,
		}));

		const configPath = `${getConfigDirPath()}/config.json`;
		console.log(`Logged out. API token removed from ${configPath}`);

		if (process.env.NIA_API_KEY) {
			console.log("Note: NIA_API_KEY environment variable is still set.");
		}
	},
});

const statusCommand = defineCommand({
	meta: {
		name: "status",
		description: "Check authentication status",
	},
	async run() {
		// Determine the token source and value
		const envKey = process.env.NIA_API_KEY;
		const config = await readConfig();
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
			console.log("Token source: none");
			console.log("Run `nia auth login` to authenticate.");
			return;
		}

		console.log("Authenticated: yes");
		console.log(`Token source: ${source}`);
		console.log(`Token: ${maskApiKey(activeKey)}`);

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
			console.log("Could not fetch plan info (token may be invalid).");
		}
	},
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

export const authCommand = defineCommand({
	meta: {
		name: "auth",
		description: "Authenticate with the Nia platform",
	},
	subCommands: {
		login: loginCommand,
		logout: logoutCommand,
		status: statusCommand,
	},
});
