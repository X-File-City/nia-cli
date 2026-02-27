import { defineCommand } from "@crustjs/core";

export const searchCommand = defineCommand({
	meta: {
		name: "search",
		description: "Search code, docs, and the web",
	},
	subCommands: {},
});
