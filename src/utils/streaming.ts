import type { StyleInstance } from "@crustjs/style";
import { createStyle } from "@crustjs/style";

/**
 * Options for the stream renderer.
 */
export interface StreamRendererOptions {
	/** Whether color output is enabled. */
	color?: boolean;
}

/**
 * Render a single SSE event to the terminal.
 *
 * Events are printed incrementally — each call outputs one event.
 * When stdout is not a TTY, events are printed as JSON lines for
 * parseable output (per SPEC constraint: no ANSI codes when piped).
 *
 * @param event - The event object from an SSE stream.
 * @param options - Rendering options.
 */
export function renderStreamEvent(
	event: Record<string, unknown>,
	options: StreamRendererOptions = {},
): void {
	const isTTY = process.stdout.isTTY;

	// Non-TTY: output each event as a JSON line
	if (!isTTY) {
		console.log(JSON.stringify(event));
		return;
	}

	const style = createStyle({
		mode: options.color === false ? "never" : "auto",
	});

	const eventType = String(event.type ?? event.event ?? "data");
	const content = extractContent(event);

	if (content) {
		renderTTYEvent(style, eventType, content);
	}
}

/**
 * Stream events from an async iterable and render them progressively.
 *
 * @param stream - An async iterable of event objects (e.g., from sdk.oracle.streamJob()).
 * @param options - Rendering options.
 */
export async function renderStream(
	stream: AsyncIterable<Record<string, unknown>>,
	options: StreamRendererOptions = {},
): Promise<void> {
	for await (const event of stream) {
		renderStreamEvent(event, options);
	}
}

/**
 * Extract the main content from an SSE event object.
 *
 * SSE events from the Nia API may have content in various fields
 * depending on the event type.
 */
function extractContent(event: Record<string, unknown>): string | null {
	// Check common content fields in order of specificity
	for (const field of ["content", "data", "message", "text", "result"]) {
		const value = event[field];
		if (value !== undefined && value !== null) {
			if (typeof value === "string") {
				return value;
			}
			return JSON.stringify(value, null, 2);
		}
	}

	// If no known content field, stringify the whole event (excluding type/event)
	const { type: _type, event: _event, ...rest } = event;
	if (Object.keys(rest).length > 0) {
		return JSON.stringify(rest, null, 2);
	}

	return null;
}

/**
 * Render a single event to the TTY with formatting.
 */
function renderTTYEvent(
	style: StyleInstance,
	eventType: string,
	content: string,
): void {
	const typeLabel = formatEventType(style, eventType);

	// For streaming text content (like oracle research output),
	// write directly without newline to allow progressive text assembly
	if (
		eventType === "content" ||
		eventType === "text" ||
		eventType === "delta"
	) {
		process.stdout.write(content);
		return;
	}

	// For status/metadata events, print with type label
	if (eventType === "done" || eventType === "complete" || eventType === "end") {
		console.log(`\n${typeLabel} ${style.green(content)}`);
		return;
	}

	if (eventType === "error") {
		console.log(`${typeLabel} ${style.red(content)}`);
		return;
	}

	// Default: print type label + content
	console.log(`${typeLabel} ${content}`);
}

/**
 * Format an event type label with color.
 */
function formatEventType(style: StyleInstance, eventType: string): string {
	switch (eventType) {
		case "thinking":
		case "searching":
		case "reading":
		case "analyzing":
			return style.dim(`[${eventType}]`);
		case "error":
			return style.red(`[${eventType}]`);
		case "done":
		case "complete":
		case "end":
			return style.green(`[${eventType}]`);
		default:
			return style.cyan(`[${eventType}]`);
	}
}
