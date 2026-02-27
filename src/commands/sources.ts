import { defineCommand } from "@crustjs/core";

export const sourcesCommand = defineCommand({
	meta: {
		name: "sources",
		description: "Manage indexed documentation and data sources",
	},
	subCommands: {},
});
