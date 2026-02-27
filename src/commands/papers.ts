import { defineCommand } from "@crustjs/core";

export const papersCommand = defineCommand({
	meta: {
		name: "papers",
		description: "Index and list arXiv research papers",
	},
	subCommands: {},
});
