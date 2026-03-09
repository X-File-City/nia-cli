import {
	autoCompletePlugin,
	helpPlugin,
	type UpdateNotifierCacheAdapter,
	updateNotifierPlugin,
	versionPlugin,
} from "@crustjs/plugins";
import { skillPlugin } from "@crustjs/skills";
import { createStore, stateDir } from "@crustjs/store";
import pkg from "../package.json";
import { app } from "./app.ts";
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

const updateStore = createStore({
	dirPath: stateDir(pkg.name),
	name: "update-notifier",
	fields: {
		lastCheckedAt: { type: "number", default: 0 },
		latestVersion: { type: "string" },
		lastNotifiedVersion: { type: "string" },
	},
});

const cacheAdaptor: UpdateNotifierCacheAdapter = {
	read: async () => updateStore.read(),
	write: async (state) =>
		updateStore.write({
			lastCheckedAt: state.lastCheckedAt,
			lastNotifiedVersion: state.lastNotifiedVersion,
			latestVersion: state.latestVersion,
		}),
};

const main = app
	.command(authCommand)
	.command(searchCommand)
	.command(reposCommand)
	.command(sourcesCommand)
	.command(oracleCommand)
	.command(tracerCommand)
	.command(contextsCommand)
	.command(packagesCommand)
	.command(githubCommand)
	.command(papersCommand)
	.command(datasetsCommand)
	.command(categoriesCommand)
	.command(usageCommand)
	.use(
		updateNotifierPlugin({
			packageName: pkg.name,
			currentVersion: pkg.version,
			cache: {
				adapter: cacheAdaptor,
			},
		}),
	)
	.use(versionPlugin(pkg.version))
	.use(helpPlugin())
	.use(autoCompletePlugin({ mode: "help" }))
	.use(
		skillPlugin({
			version: pkg.version,
			defaultScope: "global",
		}),
	);

await main.execute();
