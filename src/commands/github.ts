import { defineCommand } from "@crustjs/core";

export const githubCommand = defineCommand({
	meta: {
		name: "github",
		description: "Live search and browse any GitHub repo without indexing",
	},
	subCommands: {},
});
