import { defineCommand } from "@crustjs/core";

export const configCommand = defineCommand({
	meta: {
		name: "config",
		description: "Manage CLI configuration",
	},
	subCommands: {},
});
