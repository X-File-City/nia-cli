import { defineCommand } from "@crustjs/core";
import { V2ApiService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";
import { createSpinner } from "../utils/spinner.ts";

/**
 * Handle errors from the usage API.
 */
function handleUsageError(error: unknown): never {
	const status = (error as { status?: number }).status;
	const message = (error as Error).message ?? String(error);

	if (status === 401 || status === 403) {
		console.error("Authentication failed — run `nia auth login` to authenticate.");
	} else if (status === 429) {
		console.error("Rate limited — try again in a moment.");
	} else if (status && status >= 500) {
		console.error(`Server error (${status}) — try again later.`);
	} else {
		console.error(`Failed to fetch usage: ${message}`);
	}
	process.exit(1);
}

export const usageCommand = defineCommand({
	meta: {
		name: "usage",
		description: "View API usage summary",
	},
	args: [],
	flags: {},
	async run() {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		spinner.start("Fetching usage summary...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const result = await V2ApiService.getUsageSummaryV2V2UsageGet();

			spinner.stop("Usage retrieved");

			if (global.output === "json") {
				fmt.output(result);
				return;
			}

			// Text/table mode — structured human-readable output
			const usage = result as Record<string, unknown>;

			if (usage.subscription_tier) {
				console.log(`Plan: ${String(usage.subscription_tier)}`);
			}

			if (usage.billing_period_start && usage.billing_period_end) {
				console.log(
					`Billing period: ${String(usage.billing_period_start)} — ${String(usage.billing_period_end)}`,
				);
			}

			const ops = usage.usage as
				| Record<string, { used?: number; limit?: number; unlimited?: boolean }>
				| undefined;

			if (ops && Object.keys(ops).length > 0) {
				console.log("\nUsage breakdown:");
				for (const [key, entry] of Object.entries(ops)) {
					if (entry.unlimited) {
						console.log(`  ${key}: ${entry.used ?? 0} (unlimited)`);
					} else {
						const used = entry.used ?? 0;
						const limit = entry.limit ?? 0;
						const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
						console.log(`  ${key}: ${used}/${limit} (${pct}%)`);
					}
				}
			} else {
				console.log("\nNo usage data available.");
			}
		} catch (error) {
			spinner.stop("Failed to fetch usage");
			handleUsageError(error);
		}
	},
});
