/**
 * Centralized error handling for the Nia CLI.
 *
 * Provides a unified `handleError()` function that maps SDK, API, and framework
 * errors to user-friendly messages, and a `withErrorHandling()` wrapper for
 * command handlers.
 */

import { CrustError } from "@crustjs/core";
import { ApiError, NiaSDKError, NiaTimeoutError } from "nia-ai-ts";
import { parseGlobalFlags } from "./global-flags.ts";

/**
 * Options for error handling behavior.
 */
export interface ErrorHandlerOptions {
	/** When true, print full stack traces and raw API response bodies. */
	verbose?: boolean;
	/** Domain context for generic error messages (e.g., "Search", "Oracle"). */
	domain?: string;
}

/**
 * Format a user-friendly error message for the given error and print it.
 * Calls `process.exit(1)` after printing.
 */
export function handleError(
	error: unknown,
	options: ErrorHandlerOptions = {},
): never {
	const { verbose = false, domain } = options;

	// --- CrustError (framework-level) ---
	if (error instanceof CrustError) {
		handleCrustError(error, verbose);
	}

	// --- ApiError (generated OpenAPI client) ---
	if (error instanceof ApiError) {
		handleApiError(error, verbose, domain);
	}

	// --- NiaTimeoutError (SDK timeout) ---
	if (error instanceof NiaTimeoutError) {
		console.error(
			"Request timed out — the server took too long to respond. Try again later.",
		);
		if (verbose) {
			console.error(`\nDetails: ${error.message}`);
			if (error.stack) {
				console.error(`\nStack trace:\n${error.stack}`);
			}
		}
		process.exit(1);
	}

	// --- NiaSDKError (generic SDK error) ---
	if (error instanceof NiaSDKError) {
		console.error(`SDK error: ${error.message}`);
		if (verbose && error.stack) {
			console.error(`\nStack trace:\n${error.stack}`);
		}
		process.exit(1);
	}

	// --- Generic Error with status (e.g., fetch errors with status) ---
	if (error instanceof Error) {
		const statusError = error as Error & { status?: number };
		if (typeof statusError.status === "number") {
			handleStatusCode(
				statusError.status,
				statusError.message,
				verbose,
				domain,
			);
		}

		const label = domain ? `${domain} failed` : "Error";
		console.error(`${label}: ${error.message}`);
		if (verbose && error.stack) {
			console.error(`\nStack trace:\n${error.stack}`);
		}
		process.exit(1);
	}

	// --- Non-Error thrown values ---
	const label = domain ? `${domain} failed` : "Error";
	console.error(`${label}: ${String(error)}`);
	process.exit(1);
}

/**
 * Handle CrustError (framework-level errors).
 */
function handleCrustError(error: CrustError, verbose: boolean): never {
	if (error.is("COMMAND_NOT_FOUND")) {
		const { input, available } = error.details;
		console.error(`Unknown command: "${input}"`);

		// Suggest closest match
		const suggestion = findClosestMatch(input, available);
		if (suggestion) {
			console.error(`Did you mean "${suggestion}"?`);
		}

		if (available.length > 0) {
			console.error(`\nAvailable commands: ${available.join(", ")}`);
		}

		process.exit(1);
	}

	if (error.is("VALIDATION")) {
		const details = error.details;
		if (details?.issues && details.issues.length > 0) {
			for (const issue of details.issues) {
				console.error(`Missing required ${issue.path}: ${issue.message}`);
			}
		} else {
			console.error(error.message);
		}
		process.exit(1);
	}

	if (error.is("PARSE")) {
		console.error(`Invalid arguments: ${error.message}`);
		if (verbose && error.stack) {
			console.error(`\nStack trace:\n${error.stack}`);
		}
		process.exit(1);
	}

	// DEFINITION, EXECUTION, or other codes
	console.error(error.message);
	if (verbose && error.stack) {
		console.error(`\nStack trace:\n${error.stack}`);
	}
	process.exit(1);
}

/**
 * Handle ApiError from the generated OpenAPI client.
 */
function handleApiError(
	error: ApiError,
	verbose: boolean,
	domain?: string,
): never {
	handleStatusCode(
		error.status,
		error.message,
		verbose,
		domain,
		error.body,
		error.stack,
	);
}

/**
 * Map HTTP status codes to user-friendly error messages.
 */
function handleStatusCode(
	status: number,
	message: string,
	verbose: boolean,
	domain?: string,
	body?: unknown,
	stack?: string,
): never {
	switch (true) {
		case status === 401 || status === 403:
			console.error(
				"Authentication failed — run `nia auth login` to authenticate.",
			);
			break;

		case status === 404: {
			const label = domain ? `${domain} resource` : "Resource";
			console.error(
				`${label} not found. Check the ID or identifier and try again.`,
			);
			break;
		}

		case status === 422:
			console.error(
				`Validation error: ${extractDetailMessage(body) ?? message}`,
			);
			break;

		case status === 429:
			console.error("Rate limited — try again in a moment.");
			break;

		case status >= 500:
			console.error(`Server error (${status}) — try again later.`);
			break;

		default: {
			const label = domain ? `${domain} failed` : "Request failed";
			console.error(`${label} (${status}): ${message}`);
		}
	}

	if (verbose) {
		if (body !== undefined) {
			console.error(`\nResponse body:\n${formatBody(body)}`);
		}
		if (stack) {
			console.error(`\nStack trace:\n${stack}`);
		}
	}

	process.exit(1);
}

/**
 * Extract a user-readable detail message from an API error body.
 * Many APIs return { detail: string | { msg: string }[] }.
 */
function extractDetailMessage(body: unknown): string | undefined {
	if (body == null) return undefined;

	if (typeof body === "object") {
		const obj = body as Record<string, unknown>;

		// { detail: "message" }
		if (typeof obj.detail === "string") {
			return obj.detail;
		}

		// { detail: [{ msg: "message", loc: [...] }] }
		if (Array.isArray(obj.detail)) {
			return obj.detail
				.map((d: Record<string, unknown>) => {
					const loc = Array.isArray(d.loc) ? d.loc.join(" → ") : "";
					const msg = typeof d.msg === "string" ? d.msg : String(d.msg);
					return loc ? `${loc}: ${msg}` : msg;
				})
				.join("; ");
		}

		// { message: "message" }
		if (typeof obj.message === "string") {
			return obj.message;
		}

		// { error: "message" }
		if (typeof obj.error === "string") {
			return obj.error;
		}
	}

	if (typeof body === "string") {
		return body;
	}

	return undefined;
}

/**
 * Format a response body for verbose output.
 */
function formatBody(body: unknown): string {
	if (typeof body === "string") return body;
	try {
		return JSON.stringify(body, null, 2);
	} catch {
		return String(body);
	}
}

/**
 * Find the closest string match using Levenshtein distance.
 * Returns undefined if no match is close enough (threshold: half the input length + 2).
 */
export function findClosestMatch(
	input: string,
	candidates: string[],
): string | undefined {
	if (candidates.length === 0) return undefined;

	let bestMatch: string | undefined;
	let bestDistance = Number.POSITIVE_INFINITY;
	const threshold = Math.max(Math.floor(input.length / 3) + 1, 2);

	for (const candidate of candidates) {
		const distance = levenshteinDistance(
			input.toLowerCase(),
			candidate.toLowerCase(),
		);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestMatch = candidate;
		}
	}

	return bestDistance <= threshold ? bestMatch : undefined;
}

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;

	// Use a 1D array for space efficiency
	const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);

	for (let i = 1; i <= m; i++) {
		let prev = dp[0] ?? 0;
		dp[0] = i;
		for (let j = 1; j <= n; j++) {
			const temp = dp[j] ?? 0;
			if (a[i - 1] === b[j - 1]) {
				dp[j] = prev;
			} else {
				dp[j] = 1 + Math.min(prev, dp[j] ?? 0, dp[j - 1] ?? 0);
			}
			prev = temp;
		}
	}

	return dp[n] ?? 0;
}

/**
 * Wrap a command handler with centralized error handling.
 *
 * Usage in a defineCommand run() handler:
 *
 * ```ts
 * async run({ args, flags }) {
 *   await withErrorHandling({ domain: "Search" }, async () => {
 *     // ... command logic ...
 *   });
 * }
 * ```
 *
 * Automatically reads the --verbose flag from process.argv.
 */
export async function withErrorHandling(
	options: Omit<ErrorHandlerOptions, "verbose">,
	fn: () => Promise<void>,
): Promise<void> {
	const global = parseGlobalFlags();
	try {
		await fn();
	} catch (error) {
		handleError(error, { ...options, verbose: global.verbose });
	}
}
