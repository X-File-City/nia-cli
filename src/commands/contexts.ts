import { defineCommand } from "@crustjs/core";

export const contextsCommand = defineCommand({
	meta: {
		name: "contexts",
		description: "Save and search cross-agent contexts",
	},
	subCommands: {},
});
