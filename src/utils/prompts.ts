import { confirm, input, select } from "@crustjs/prompts";
import { resolveApiKey } from "../services/config.ts";

/**
 * Check if the terminal is interactive (stdout is a TTY).
 */
export function isTTY(): boolean {
	return !!process.stdout.isTTY;
}

/**
 * Check if an API key is available from any source in the resolution chain.
 * If not, print a helpful first-run message and exit.
 *
 * Call this at the start of any command that requires authentication.
 * The `apiKeyOverride` should come from the --api-key global flag.
 */
export async function checkFirstRun(apiKeyOverride?: string): Promise<void> {
	const key = await resolveApiKey(apiKeyOverride);
	if (!key) {
		console.error("No API key found. Run `nia auth login` to get started.");
		console.error("Or set the NIA_API_KEY environment variable, or pass --api-key <value>.");
		process.exit(1);
	}
}

/**
 * Require a positional argument value. If the value is missing:
 * - In a TTY, prompt the user interactively.
 * - In a non-TTY, print an error and exit.
 *
 * @param value - The value from the parsed CLI arg (may be empty string or undefined)
 * @param options - Prompt options
 * @returns The resolved value (either from arg or prompt)
 */
export async function requireArg(
	value: string | undefined,
	options: {
		name: string;
		message: string;
		validate?: (v: string) => string | true;
	},
): Promise<string> {
	if (value) {
		return value;
	}

	if (!isTTY()) {
		console.error(
			`Missing required argument: <${options.name}>. Provide it as a positional argument or run in an interactive terminal.`,
		);
		process.exit(1);
	}

	const result = await input({
		message: options.message,
		validate: options.validate,
	});

	if (!result) {
		console.error(`No ${options.name} provided. Aborting.`);
		process.exit(1);
	}

	return result;
}

/**
 * Prompt for an optional text input when in a TTY.
 * Returns undefined if not in a TTY or user skips.
 *
 * @param options - Prompt options
 * @returns The value or undefined
 */
export async function promptOptional(options: {
	message: string;
	initial?: string;
}): Promise<string | undefined> {
	if (!isTTY()) {
		return undefined;
	}

	const result = await input({
		message: options.message,
		initial: options.initial,
	});

	return result || undefined;
}

/**
 * Prompt for a selection from a list of choices when in a TTY.
 * Returns undefined if not in a TTY.
 *
 * @param options - Select prompt options
 * @returns The selected value or undefined
 */
export async function promptSelect<T extends string>(options: {
	message: string;
	choices: Array<{ label: string; value: T }>;
}): Promise<T | undefined> {
	if (!isTTY()) {
		return undefined;
	}

	return await select<T>({
		message: options.message,
		choices: options.choices,
	});
}

/**
 * Prompt for a yes/no confirmation when in a TTY.
 * Returns the default value if not in a TTY.
 *
 * @param options - Confirm prompt options
 * @returns The confirmation result
 */
export async function promptConfirm(options: {
	message: string;
	initial?: boolean;
}): Promise<boolean> {
	if (!isTTY()) {
		return options.initial ?? false;
	}

	return await confirm({
		message: options.message,
		initial: options.initial,
	});
}
