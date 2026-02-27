import type { StyleInstance } from "@crustjs/style";
import { createStyle, stripAnsi, table as styleTable } from "@crustjs/style";

/**
 * Output format modes.
 */
export type OutputFormat = "json" | "table" | "text";

/**
 * Options for creating a formatter instance.
 */
export interface FormatterOptions {
	/** Explicit output format. Overrides TTY auto-detection. */
	output?: string;
	/** Whether color output is enabled. */
	color?: boolean;
}

/**
 * Resolve the output format from explicit option or TTY auto-detection.
 *
 * - If an explicit format is provided, validate and use it.
 * - If no format is specified, default to "text" when stdout is a TTY,
 *   "json" when piped.
 */
export function resolveOutputFormat(output?: string): OutputFormat {
	if (output) {
		const normalized = output.toLowerCase();
		if (normalized === "json" || normalized === "table" || normalized === "text") {
			return normalized;
		}
		// Invalid format — fall through to auto-detection
	}

	return process.stdout.isTTY ? "text" : "json";
}

/**
 * Maximum column width for table cells before truncation.
 */
const MAX_CELL_WIDTH = 60;

/**
 * Truncate a string to a maximum visible length, appending "..." if truncated.
 */
export function truncate(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}
	if (maxLength <= 3) {
		return value.slice(0, maxLength);
	}
	return `${value.slice(0, maxLength - 3)}...`;
}

/**
 * Formatter provides output formatting with TTY-aware defaults.
 *
 * Instantiate via `createFormatter()` for each command invocation.
 */
export class Formatter {
	readonly format: OutputFormat;
	readonly style: StyleInstance;

	constructor(options: FormatterOptions = {}) {
		this.format = resolveOutputFormat(options.output);
		this.style = createStyle({
			mode: options.color === false ? "never" : "auto",
		});
	}

	/**
	 * Format data as JSON with 2-space indentation.
	 */
	formatJson(data: unknown): string {
		return JSON.stringify(data, null, 2);
	}

	/**
	 * Format rows as an aligned table with headers.
	 *
	 * @param rows - Array of records to display.
	 * @param columns - Optional column names to include. If not provided,
	 *   uses the keys from the first row.
	 */
	formatTable(rows: Record<string, unknown>[], columns?: string[]): string {
		if (rows.length === 0) {
			return this.style.dim("(no results)");
		}

		const cols = columns ?? Object.keys(rows[0] ?? {});
		if (cols.length === 0) {
			return this.style.dim("(no columns)");
		}

		// Build header labels — capitalize first letter
		const headers = cols.map((col) => {
			const label = col.replace(/([A-Z])/g, " $1").trim();
			return this.style.bold(label.charAt(0).toUpperCase() + label.slice(1));
		});

		// Build data rows — convert values to strings and truncate
		const dataRows = rows.map((row) =>
			cols.map((col) => {
				const value = row[col];
				const str = formatValue(value);
				return truncate(str, MAX_CELL_WIDTH);
			}),
		);

		return styleTable(headers, dataRows, {
			cellPadding: 1,
		});
	}

	/**
	 * Format data as human-friendly text output.
	 *
	 * Handles primitives, arrays, and nested objects with indentation.
	 */
	formatText(data: unknown, indent = 0): string {
		const prefix = "  ".repeat(indent);

		if (data === null || data === undefined) {
			return `${prefix}${this.style.dim("(none)")}`;
		}

		if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
			return `${prefix}${String(data)}`;
		}

		if (Array.isArray(data)) {
			if (data.length === 0) {
				return `${prefix}${this.style.dim("(empty)")}`;
			}

			// If array of primitives, join them
			if (data.every((item) => typeof item !== "object" || item === null)) {
				return data.map((item) => `${prefix}- ${String(item)}`).join("\n");
			}

			// Array of objects — format each
			return data
				.map((item, i) => `${prefix}[${i}]\n${this.formatText(item, indent + 1)}`)
				.join("\n");
		}

		if (typeof data === "object") {
			const entries = Object.entries(data as Record<string, unknown>);
			if (entries.length === 0) {
				return `${prefix}${this.style.dim("(empty)")}`;
			}

			return entries
				.map(([key, value]) => {
					const label = this.style.bold(key);
					if (typeof value === "object" && value !== null) {
						return `${prefix}${label}:\n${this.formatText(value, indent + 1)}`;
					}
					return `${prefix}${label}: ${formatValue(value)}`;
				})
				.join("\n");
		}

		return `${prefix}${String(data)}`;
	}

	/**
	 * Format a list of items in a compact display.
	 */
	formatList(items: { id: string; name: string; status?: string }[]): string {
		if (items.length === 0) {
			return this.style.dim("(no items)");
		}

		return items
			.map((item) => {
				const id = this.style.dim(truncate(item.id, 12));
				const name = this.style.bold(item.name);
				const status = item.status ? ` ${this.formatStatus(item.status)}` : "";
				return `${id}  ${name}${status}`;
			})
			.join("\n");
	}

	/**
	 * Output data in the configured format.
	 *
	 * This is the main entry point for command output. It auto-selects
	 * the formatting method based on the resolved output format.
	 */
	output(data: unknown, options?: { columns?: string[] }): void {
		let result: string;

		switch (this.format) {
			case "json":
				result = this.formatJson(data);
				break;
			case "table": {
				const rows = Array.isArray(data)
					? (data as Record<string, unknown>[])
					: [data as Record<string, unknown>];
				result = this.formatTable(rows, options?.columns);
				break;
			}
			case "text":
				result = this.formatText(data);
				break;
		}

		console.log(result);
	}

	/**
	 * Print a success message.
	 */
	success(message: string): void {
		console.log(this.style.green(message));
	}

	/**
	 * Print a warning message.
	 */
	warn(message: string): void {
		console.error(this.style.yellow(message));
	}

	/**
	 * Print an error message.
	 */
	error(message: string): void {
		console.error(this.style.red(message));
	}

	/**
	 * Print an informational message (dimmed).
	 */
	info(message: string): void {
		console.log(this.style.dim(message));
	}

	/**
	 * Format a status string with color.
	 */
	private formatStatus(status: string): string {
		const lower = status.toLowerCase();
		switch (lower) {
			case "completed":
			case "ready":
			case "active":
			case "indexed":
				return this.style.green(status);
			case "running":
			case "queued":
			case "indexing":
			case "processing":
				return this.style.yellow(status);
			case "failed":
			case "error":
				return this.style.red(status);
			case "cancelled":
			case "canceled":
				return this.style.dim(status);
			default:
				return status;
		}
	}
}

/**
 * Convert an unknown value to a display string.
 */
function formatValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.map(String).join(", ");
	}
	if (typeof value === "object") {
		return JSON.stringify(value);
	}
	return String(value);
}

/**
 * Factory function to create a Formatter with resolved global flags.
 */
export function createFormatter(flags: FormatterOptions = {}): Formatter {
	return new Formatter(flags);
}

/**
 * Strip all ANSI escape codes from a string.
 * Re-exported for convenience.
 */
export { stripAnsi };
