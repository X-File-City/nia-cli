import { defineCommand } from "@crustjs/core";

export const usageCommand = defineCommand({
	meta: {
		name: "usage",
		description: "View API usage summary",
	},
	subCommands: {},
});
