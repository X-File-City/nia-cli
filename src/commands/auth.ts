import { defineCommand } from "@crustjs/core";

export const authCommand = defineCommand({
	meta: {
		name: "auth",
		description: "Authenticate with the Nia platform",
	},
	subCommands: {},
});
