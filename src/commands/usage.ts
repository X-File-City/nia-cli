import { defineCommand } from "@crustjs/core";
import { spinner } from "@crustjs/prompts";
import { V2ApiService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { handleError } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";

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

		try {
			const result = await spinner({
				message: "Fetching usage summary...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });
					return await V2ApiService.getUsageSummaryV2V2UsageGet();
				},
			});

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
			handleError(error, { domain: "Usage" });
		}
	},
});
