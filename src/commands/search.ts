import { spinner } from "@crustjs/prompts";
import { app } from "../app.ts";
import { createSdk } from "../services/sdk.ts";
import { withErrorHandling } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";

const universalCommand = app
	.sub("universal")
	.meta({ description: "Semantic search across all indexed sources" })
	.args([
		{
			name: "query",
			type: "string",
			description: "Search query",
			required: true,
		},
	] as const)
	.flags({
		"top-k": {
			type: "number",
			description: "Number of results to return",
		},
		"include-repos": {
			type: "boolean",
			description: "Include repository sources",
		},
		"include-docs": {
			type: "boolean",
			description: "Include documentation sources",
		},
	})
	.run(async ({ args, flags }) => {
		const fmt = createFormatter({ color: flags.color });

		await withErrorHandling({ domain: "Search" }, async () => {
			const result = await spinner({
				message: "Searching...",
				task: async () => {
					const sdk = await createSdk({ apiKey: flags["api-key"] });

					const params: Record<string, unknown> = {
						query: args.query,
					};

					if (flags["top-k"] !== undefined) {
						params.top_k = flags["top-k"];
					}
					if (flags["include-repos"] !== undefined) {
						params.include_repos = flags["include-repos"];
					}
					if (flags["include-docs"] !== undefined) {
						params.include_docs = flags["include-docs"];
					}

					return await sdk.search.universal(params);
				},
			});

			fmt.output(result);
		});
	});

const queryCommand = app
	.sub("query")
	.meta({ description: "Query indexed repositories and documentation" })
	.args([
		{
			name: "query",
			type: "string",
			description: "Search query",
			required: true,
		},
	] as const)
	.flags({
		repos: {
			type: "string",
			description: "Repository names to search (comma-separated)",
		},
		docs: {
			type: "string",
			description: "Documentation source names to search (comma-separated)",
		},
		"search-mode": {
			type: "string",
			description: "Search mode: repositories, sources, unified",
		},
		"max-tokens": {
			type: "number",
			description: "Maximum tokens in response",
		},
		fast: {
			type: "boolean",
			description: "Fast mode — skip LLM processing (100-500ms)",
		},
		"skip-llm": {
			type: "boolean",
			description: "Return raw results without LLM processing",
		},
		strategy: {
			type: "string",
			description: "Retrieval strategy: vector, tree, hybrid",
		},
		model: {
			type: "string",
			description: "LLM model to use for processing",
		},
	})
	.run(async ({ args, flags }) => {
		const fmt = createFormatter({ color: flags.color });

		await withErrorHandling({ domain: "Search" }, async () => {
			const result = await spinner({
				message: "Querying...",
				task: async () => {
					const sdk = await createSdk({ apiKey: flags["api-key"] });

					const params: Record<string, unknown> = {
						messages: [{ role: "user", content: args.query }],
					};

					if (flags.repos) {
						params.repositories = flags.repos.split(",").map((s) => s.trim());
					}
					if (flags.docs) {
						params.data_sources = flags.docs.split(",").map((s) => s.trim());
					}
					if (flags["search-mode"]) {
						params.search_mode = flags["search-mode"];
					}
					if (flags["max-tokens"] !== undefined) {
						params.max_tokens = flags["max-tokens"];
					}
					if (flags.fast !== undefined) {
						params.fast_mode = flags.fast;
					}
					if (flags["skip-llm"] !== undefined) {
						params.skip_llm = flags["skip-llm"];
					}
					if (flags.strategy) {
						params.reasoning_strategy = flags.strategy;
					}
					if (flags.model) {
						params.model = flags.model;
					}

					return await sdk.search.query(params);
				},
			});

			fmt.output(result);
		});
	});

const WEB_SEARCH_CATEGORIES = [
	"github",
	"company",
	"research",
	"news",
	"tweet",
	"pdf",
	"blog",
] as const;

const webCommand = app
	.sub("web")
	.meta({ description: "Search the web for code, documentation, and research" })
	.args([
		{
			name: "query",
			type: "string",
			description: "Search query",
			required: true,
		},
	] as const)
	.flags({
		"num-results": {
			type: "number",
			description: "Number of results to return",
		},
		category: {
			type: "string",
			description:
				"Category filter: github, company, research, news, tweet, pdf, blog",
		},
		"days-back": {
			type: "number",
			description: "Only results from the last N days",
		},
	})
	.run(async ({ args, flags }) => {
		const fmt = createFormatter({ color: flags.color });

		// Validate category if provided
		if (
			flags.category &&
			!WEB_SEARCH_CATEGORIES.includes(
				flags.category as (typeof WEB_SEARCH_CATEGORIES)[number],
			)
		) {
			fmt.error(
				`Invalid category: "${flags.category}". Allowed: ${WEB_SEARCH_CATEGORIES.join(", ")}`,
			);
			process.exit(1);
		}

		await withErrorHandling({ domain: "Search" }, async () => {
			const result = await spinner({
				message: "Searching the web...",
				task: async () => {
					const sdk = await createSdk({ apiKey: flags["api-key"] });

					const params: Record<string, unknown> = {
						query: args.query,
					};

					if (flags["num-results"] !== undefined) {
						params.num_results = flags["num-results"];
					}
					if (flags.category) {
						params.category = flags.category;
					}
					if (flags["days-back"] !== undefined) {
						params.days_back = flags["days-back"];
					}

					return await sdk.search.web(params);
				},
			});

			fmt.output(result);
		});
	});

const deepCommand = app
	.sub("deep")
	.meta({ description: "Deep multi-step research (Pro plan required)" })
	.args([
		{
			name: "query",
			type: "string",
			description: "Research question",
			required: true,
		},
	] as const)
	.flags({
		"output-format": {
			type: "string",
			description: "Optional structure hint for the output",
		},
		model: {
			type: "string",
			description: "LLM model to use for research",
		},
	})
	.run(async ({ args, flags }) => {
		const fmt = createFormatter({ color: flags.color });

		await withErrorHandling({ domain: "Search" }, async () => {
			const result = await spinner({
				message: "Running deep research...",
				task: async () => {
					const sdk = await createSdk({ apiKey: flags["api-key"] });

					const params: Record<string, unknown> = {
						query: args.query,
					};

					if (flags["output-format"]) {
						params.output_format = flags["output-format"];
					}
					if (flags.model) {
						params.model = flags.model;
					}
					if (flags.verbose) {
						params.verbose = true;
					}

					return await sdk.search.deep(params);
				},
			});

			fmt.output(result);
		});
	});

export const searchCommand = app
	.sub("search")
	.meta({ description: "Search code, docs, and the web" })
	.command(universalCommand)
	.command(queryCommand)
	.command(webCommand)
	.command(deepCommand);
