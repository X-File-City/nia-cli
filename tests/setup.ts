/**
 * Shared test configuration for nia-cli tests.
 *
 * This file is loaded via bunfig.toml preload before test execution.
 * Add global mocks, test helpers, and shared fixtures here.
 */

// Ensure tests don't accidentally use real config paths
process.env.XDG_CONFIG_HOME = "/tmp/nia-cli-test-config";

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG) {
	const _noop = () => {};
	// biome-ignore lint/suspicious/noExplicitAny: test setup intentionally silences console
	(globalThis as any).__originalConsole = {
		log: console.log,
		error: console.error,
		warn: console.warn,
	};
}
