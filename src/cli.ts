import { defineCommand, runMain } from "@crustjs/core";
import {
	autoCompletePlugin,
	helpPlugin,
	versionPlugin,
} from "@crustjs/plugins";
import pkg from "../package.json";
import { authCommand } from "./commands/auth";
import { categoriesCommand } from "./commands/categories";
import { contextsCommand } from "./commands/contexts";
import { datasetsCommand } from "./commands/datasets";
import { githubCommand } from "./commands/github";
import { oracleCommand } from "./commands/oracle";
import { packagesCommand } from "./commands/packages";
import { papersCommand } from "./commands/papers";
import { reposCommand } from "./commands/repos";
import { searchCommand } from "./commands/search";
import { sourcesCommand } from "./commands/sources";
import { tracerCommand } from "./commands/tracer";
import { usageCommand } from "./commands/usage";

const main = defineCommand({
	meta: {
		name: "nia",
		description: pkg.description,
	},
	flags: {
		"api-key": {
			type: "string",
			description: "Nia API key (overrides env and config)",
		},
		output: {
			type: "string",
			description: "Output format: json, table, text",
			alias: "o",
		},
		verbose: {
			type: "boolean",
			description: "Enable verbose output",
		},
		color: {
			type: "boolean",
			description: "Colored output (use --no-color to disable)",
			default: true,
		},
	},
	subCommands: {
		auth: authCommand,
		search: searchCommand,
		repos: reposCommand,
		sources: sourcesCommand,
		oracle: oracleCommand,
		tracer: tracerCommand,
		contexts: contextsCommand,
		packages: packagesCommand,
		github: githubCommand,
		papers: papersCommand,
		datasets: datasetsCommand,
		categories: categoriesCommand,
		usage: usageCommand,
	},
});

runMain(main, {
	plugins: [
		versionPlugin(pkg.version),
		helpPlugin(),
		autoCompletePlugin({ mode: "help" }),
	],
});
