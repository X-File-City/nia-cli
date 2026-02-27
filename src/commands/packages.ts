import { defineCommand } from "@crustjs/core";

export const packagesCommand = defineCommand({
	meta: {
		name: "packages",
		description: "Search npm, PyPI, crates.io, and Go packages",
	},
	subCommands: {},
});
