import { defineCommand } from "@crustjs/core";
import type {
	PackageSearchGrepRequest,
	PackageSearchHybridRequest,
	PackageSearchReadFileRequest,
} from "nia-ai-ts";
import { V2ApiPackageSearchService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { handleError } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";
import { createSpinner } from "../utils/spinner.ts";

/**
 * Valid package registries supported by the API.
 */
const VALID_REGISTRIES = ["npm", "py_pi", "crates_io", "golang_proxy", "ruby_gems"];

/**
 * Validate registry argument against allowed values.
 */
function validateRegistry(registry: string): void {
	if (!VALID_REGISTRIES.includes(registry)) {
		console.error(`Invalid registry: "${registry}". Allowed: ${VALID_REGISTRIES.join(", ")}`);
		process.exit(1);
	}
}

// --- Subcommands ---

const grepCommand = defineCommand({
	meta: {
		name: "grep",
		description: "Regex search over public package source code",
	},
	args: [
		{
			name: "registry",
			type: "string",
			description: "Package registry: npm, py_pi, crates_io, golang_proxy, ruby_gems",
			required: true,
		},
		{
			name: "package",
			type: "string",
			description: "Package name",
			required: true,
		},
		{
			name: "pattern",
			type: "string",
			description: "Regex pattern to search",
			required: true,
		},
	] as const,
	flags: {
		version: {
			type: "string",
			description: "Package version to search",
		},
		language: {
			type: "string",
			description: "Language filter",
		},
		"context-before": {
			type: "number",
			description: "Lines of context before each match",
		},
		"context-after": {
			type: "number",
			description: "Lines of context after each match",
		},
		"output-mode": {
			type: "string",
			description: "Output mode: content, files_with_matches, or count",
		},
		"head-limit": {
			type: "number",
			description: "Limit number of results",
		},
		"file-sha256": {
			type: "string",
			description: "File SHA256 filter to search a specific file",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		validateRegistry(args.registry);

		spinner.start("Searching package source code...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const payload: PackageSearchGrepRequest = {
				registry: args.registry,
				package_name: args.package,
				pattern: args.pattern,
			};

			if (flags.version) {
				payload.version = flags.version;
			}
			if (flags.language) {
				payload.language = flags.language;
			}
			if (flags["file-sha256"]) {
				payload.filename_sha256 = flags["file-sha256"];
			}
			if (flags["context-before"] !== undefined) {
				payload.b = flags["context-before"];
			}
			if (flags["context-after"] !== undefined) {
				payload.a = flags["context-after"];
			}
			if (flags["head-limit"] !== undefined) {
				payload.head_limit = flags["head-limit"];
			}
			if (flags["output-mode"]) {
				payload.output_mode = flags["output-mode"];
			}

			const result =
				await V2ApiPackageSearchService.packageSearchGrepV2V2PackageSearchGrepPost(payload);

			spinner.stop("Search complete");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Search failed");
			handleError(error, { domain: "Package search" });
		}
	},
});

const hybridCommand = defineCommand({
	meta: {
		name: "hybrid",
		description: "Hybrid semantic + keyword search over package source",
	},
	args: [
		{
			name: "registry",
			type: "string",
			description: "Package registry: npm, py_pi, crates_io, golang_proxy, ruby_gems",
			required: true,
		},
		{
			name: "package",
			type: "string",
			description: "Package name",
			required: true,
		},
		{
			name: "query",
			type: "string",
			description: "Semantic search query (1-5 queries, comma-separated)",
			required: true,
		},
	] as const,
	flags: {
		version: {
			type: "string",
			description: "Package version to search",
		},
		pattern: {
			type: "string",
			description: "Regex pattern pre-filter",
		},
		language: {
			type: "string",
			description: "Language filter",
		},
		"file-sha256": {
			type: "string",
			description: "File SHA256 filter to search a specific file",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		validateRegistry(args.registry);

		spinner.start("Running semantic package search...");

		try {
			await createSdk({ apiKey: global.apiKey });

			// Split comma-separated queries into an array (1-5 queries)
			const semanticQueries = args.query.split(",").map((s) => s.trim());

			const payload: PackageSearchHybridRequest = {
				registry: args.registry,
				package_name: args.package,
				semantic_queries: semanticQueries,
			};

			if (flags.version) {
				payload.version = flags.version;
			}
			if (flags.pattern) {
				payload.pattern = flags.pattern;
			}
			if (flags.language) {
				payload.language = flags.language;
			}
			if (flags["file-sha256"]) {
				payload.filename_sha256 = flags["file-sha256"];
			}

			const result =
				await V2ApiPackageSearchService.packageSearchHybridV2V2PackageSearchHybridPost(payload);

			spinner.stop("Search complete");
			fmt.output(result);
		} catch (error) {
			spinner.stop("Search failed");
			handleError(error, { domain: "Package search" });
		}
	},
});

const readCommand = defineCommand({
	meta: {
		name: "read",
		description: "Read specific lines from a package source file (max 200 lines)",
	},
	args: [
		{
			name: "registry",
			type: "string",
			description: "Package registry: npm, py_pi, crates_io, golang_proxy, ruby_gems",
			required: true,
		},
		{
			name: "package",
			type: "string",
			description: "Package name",
			required: true,
		},
		{
			name: "sha256",
			type: "string",
			description: "File SHA256 identifier (from grep results)",
			required: true,
		},
		{
			name: "start",
			type: "number",
			description: "Start line number (1-based)",
			required: true,
		},
		{
			name: "end",
			type: "number",
			description: "End line number (1-based, max 200 lines from start)",
			required: true,
		},
	] as const,
	flags: {
		version: {
			type: "string",
			description: "Package version",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });
		const spinner = createSpinner({ color: global.color });

		validateRegistry(args.registry);

		// Validate line range
		if (args.end - args.start > 200) {
			fmt.error("Maximum 200 lines per read request. Reduce the line range.");
			process.exit(1);
		}

		spinner.start("Reading package file...");

		try {
			await createSdk({ apiKey: global.apiKey });

			const payload: PackageSearchReadFileRequest = {
				registry: args.registry,
				package_name: args.package,
				filename_sha256: args.sha256,
				start_line: args.start,
				end_line: args.end,
			};

			if (flags.version) {
				payload.version = flags.version;
			}

			const result =
				await V2ApiPackageSearchService.packageSearchReadFileV2V2PackageSearchReadFilePost(payload);

			spinner.stop("File content retrieved");

			// In text mode, display file content with line numbers if available
			if (global.output !== "json") {
				const data = result as Record<string, unknown>;
				if (typeof data.content === "string") {
					const lines = data.content.split("\n");
					const startLine = args.start;
					const padWidth = String(startLine + lines.length - 1).length;
					for (let i = 0; i < lines.length; i++) {
						const lineNum = String(startLine + i).padStart(padWidth, " ");
						console.log(`${lineNum} | ${lines[i]}`);
					}
				} else {
					fmt.output(result);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			spinner.stop("Failed to read file");
			handleError(error, { domain: "Package search" });
		}
	},
});

export const packagesCommand = defineCommand({
	meta: {
		name: "packages",
		description: "Search npm, PyPI, crates.io, and Go packages",
	},
	subCommands: {
		grep: grepCommand,
		hybrid: hybridCommand,
		read: readCommand,
	},
});
