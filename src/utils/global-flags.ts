/**
 * Parse global flags from process.argv.
 *
 * CrustJS does not propagate parent command flags to subcommands.
 * This utility manually extracts the root-level flags (--api-key, --output,
 * --verbose, --no-color) from the raw argv so subcommand handlers can use them.
 */

export interface GlobalFlags {
	/** API key override from --api-key flag. */
	apiKey?: string;
	/** Output format from --output / -o flag. */
	output?: string;
	/** Verbose mode from --verbose flag. */
	verbose?: boolean;
	/** Color mode — false when --no-color is passed. */
	color?: boolean;
}

/**
 * Extract global flags from the given argv array.
 *
 * Handles:
 *   --api-key <value>   / --api-key=<value>
 *   --output <value>    / --output=<value> / -o <value>
 *   --verbose
 *   --no-color
 */
export function parseGlobalFlags(argv: string[] = process.argv): GlobalFlags {
	const flags: GlobalFlags = {};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i] ?? "";

		// --api-key=value
		if (arg.startsWith("--api-key=")) {
			flags.apiKey = arg.slice("--api-key=".length);
			continue;
		}

		// --api-key value
		if (arg === "--api-key") {
			const next = argv[i + 1];
			if (next && !next.startsWith("-")) {
				flags.apiKey = next;
				i++;
			}
			continue;
		}

		// --output=value
		if (arg.startsWith("--output=")) {
			flags.output = arg.slice("--output=".length);
			continue;
		}

		// --output value
		if (arg === "--output") {
			const next = argv[i + 1];
			if (next && !next.startsWith("-")) {
				flags.output = next;
				i++;
			}
			continue;
		}

		// -o value
		if (arg === "-o") {
			const next = argv[i + 1];
			if (next && !next.startsWith("-")) {
				flags.output = next;
				i++;
			}
			continue;
		}

		// --verbose
		if (arg === "--verbose") {
			flags.verbose = true;
			continue;
		}

		// --no-color
		if (arg === "--no-color") {
			flags.color = false;
		}
	}

	return flags;
}
