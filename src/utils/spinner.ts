import { createStyle } from "@crustjs/style";

/**
 * Spinner frames for terminal animation.
 */
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Interval between spinner frames in milliseconds.
 */
const FRAME_INTERVAL = 80;

/**
 * Options for creating a spinner.
 */
export interface SpinnerOptions {
	/** Whether color output is enabled. */
	color?: boolean;
}

/**
 * A simple terminal spinner for indicating long-running operations.
 *
 * The spinner is a no-op when stdout is not a TTY, per the SPEC constraint:
 * "no ANSI codes or spinners in non-TTY contexts."
 */
export interface Spinner {
	/** Start the spinner with a message. */
	start(message: string): void;
	/** Update the spinner message while running. */
	update(message: string): void;
	/** Stop the spinner and print a final message. */
	stop(message: string): void;
}

/**
 * Create a terminal spinner.
 *
 * Returns a no-op spinner when stdout is not a TTY.
 */
export function createSpinner(options: SpinnerOptions = {}): Spinner {
	if (!process.stdout.isTTY) {
		return createNoopSpinner();
	}

	return createTTYSpinner(options);
}

/**
 * No-op spinner for non-TTY environments.
 * Does not output anything — callers use console.log directly for non-TTY feedback.
 */
function createNoopSpinner(): Spinner {
	return {
		start() {},
		update() {},
		stop() {},
	};
}

/**
 * TTY spinner with animated frames.
 */
function createTTYSpinner(options: SpinnerOptions): Spinner {
	const style = createStyle({
		mode: options.color === false ? "never" : "auto",
	});

	let timer: ReturnType<typeof setInterval> | null = null;
	let frameIndex = 0;
	let currentMessage = "";

	function clearLine(): void {
		process.stdout.write("\r\x1b[K");
	}

	function render(): void {
		const frame = style.cyan(FRAMES[frameIndex % FRAMES.length] ?? "⠋");
		clearLine();
		process.stdout.write(`${frame} ${currentMessage}`);
		frameIndex++;
	}

	return {
		start(message: string) {
			currentMessage = message;
			frameIndex = 0;

			// Stop any existing timer
			if (timer) {
				clearInterval(timer);
			}

			render();
			timer = setInterval(render, FRAME_INTERVAL);
		},

		update(message: string) {
			currentMessage = message;
		},

		stop(message: string) {
			if (timer) {
				clearInterval(timer);
				timer = null;
			}

			clearLine();
			console.log(`${style.green("✓")} ${message}`);
		},
	};
}
