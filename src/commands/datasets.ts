import { defineCommand } from "@crustjs/core";

export const datasetsCommand = defineCommand({
	meta: {
		name: "datasets",
		description: "Index and list HuggingFace datasets",
	},
	subCommands: {},
});
