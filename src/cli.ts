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
import { APP_NAME } from "./services/config.ts";

const updateStore = createStore({
	dirPath: stateDir(APP_NAME),
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
			instructions: `
**NEVER use web fetch or web search without checking Nia indexed sources first.**

1. **Check what's indexed**: \`nia sources list\` and \`nia repos list\` to see all indexed sources.
2. **Source exists? Search it**: \`nia search query\`, \`nia repos grep\`, \`nia sources grep\`, \`nia repos read\`, \`nia sources read\`.
3. **Source not indexed but URL known?** Index it first with \`nia repos index\` or \`nia sources index\`, then search.
4. **Source completely unknown?** Only then use \`nia search web\` or \`nia search deep\`.

Indexed sources are always more accurate and complete than web fetches. Web fetch returns truncated/summarized content. Nia provides full source code and documentation. **No skipping to web.**

#### General Notes

- For docs, always index the root link (e.g., \`https://docs.stripe.com\`) to scrape all pages.
- Indexing takes 1-5 minutes. Wait, then run \`nia sources list\` or \`nia repos list\` again to check status.
- Most endpoints accept **flexible identifiers**: UUID, display name, or URL.

#### Source Types

| Type | Index Command | Identifier Examples |
|------|---------------|---------------------|
| Repository | \`nia repos index\` | \`owner/repo\`, \`microsoft/vscode\` |
| Documentation | \`nia sources index\` | \`https://docs.example.com\` |
| Research Paper | \`nia papers index\` | \`2312.00752\`, arXiv URL |
| HuggingFace Dataset | \`nia datasets index\` | \`squad\`, \`owner/dataset\` |

#### Search Modes

For \`nia search query\`:
- \`repositories\` -- Search GitHub repositories only (auto-detected when only \`--repos\` is passed).
- \`sources\` -- Search data sources only (auto-detected when only \`--docs\` is passed).
- \`unified\` -- Search both (default when both are passed).
`,
		}),
	);

await main.execute();
