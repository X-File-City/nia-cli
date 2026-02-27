import { defineCommand } from "@crustjs/core";

export const reposCommand = defineCommand({
	meta: {
		name: "repos",
		description: "Manage indexed repositories",
	},
	subCommands: {},
});
