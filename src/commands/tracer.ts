import { defineCommand } from "@crustjs/core";

export const tracerCommand = defineCommand({
	meta: {
		name: "tracer",
		description: "Autonomous GitHub code search without indexing",
	},
	subCommands: {},
});
