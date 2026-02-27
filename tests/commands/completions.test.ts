import { describe, expect, test } from "bun:test";
import {
	generateBashCompletions,
	generateFishCompletions,
	generateZshCompletions,
} from "../../src/commands/completions.ts";

/**
 * All expected top-level commands for completeness verification.
 */
const ALL_TOP_COMMANDS = [
	"auth",
	"search",
	"repos",
	"sources",
	"oracle",
	"tracer",
	"contexts",
	"packages",
	"github",
	"papers",
	"datasets",
	"categories",
	"usage",
	"config",
	"completions",
];

/**
 * Expected subcommands per top-level command.
 */
const EXPECTED_SUBCOMMANDS: Record<string, string[]> = {
	auth: ["login", "logout", "status"],
	search: ["universal", "query", "web", "deep"],
	repos: [
		"index",
		"list",
		"status",
		"delete",
		"rename",
		"read",
		"grep",
		"tree",
	],
	sources: [
		"index",
		"list",
		"get",
		"resolve",
		"update",
		"delete",
		"sync",
		"rename",
		"read",
		"grep",
		"tree",
		"ls",
	],
	oracle: [
		"job",
		"status",
		"cancel",
		"jobs",
		"stream",
		"sessions",
		"session",
		"messages",
		"chat",
		"delete-session",
		"1m-usage",
	],
	tracer: ["run", "status", "stream", "list", "delete"],
	contexts: ["save", "list", "search", "semantic", "get", "update", "delete"],
	packages: ["grep", "hybrid", "read"],
	github: ["glob", "read", "search", "tree"],
	papers: ["index", "list"],
	datasets: ["index", "list"],
	categories: ["list", "create", "update", "delete", "assign"],
	usage: [],
	config: ["set", "get", "list"],
	completions: ["bash", "zsh", "fish"],
};

describe("shell completions", () => {
	// --- COMMAND_TREE coverage ---

	describe("command tree completeness", () => {
		test("all 15 top-level commands are present in bash output", () => {
			const script = generateBashCompletions();
			for (const cmd of ALL_TOP_COMMANDS) {
				expect(script).toContain(cmd);
			}
		});

		test("all 15 top-level commands are present in zsh output", () => {
			const script = generateZshCompletions();
			for (const cmd of ALL_TOP_COMMANDS) {
				expect(script).toContain(cmd);
			}
		});

		test("all 15 top-level commands are present in fish output", () => {
			const script = generateFishCompletions();
			for (const cmd of ALL_TOP_COMMANDS) {
				expect(script).toContain(cmd);
			}
		});
	});

	// --- Bash completions ---

	describe("bash completions", () => {
		test("generates a valid bash function", () => {
			const script = generateBashCompletions();
			expect(script).toContain("_nia_completions()");
			expect(script).toContain("complete -F _nia_completions nia");
		});

		test("uses compgen for word generation", () => {
			const script = generateBashCompletions();
			expect(script).toContain("compgen -W");
		});

		test("has case statement for subcommand routing", () => {
			const script = generateBashCompletions();
			expect(script).toContain("case");
			expect(script).toContain("esac");
		});

		test("includes all auth subcommands", () => {
			const script = generateBashCompletions();
			for (const sub of EXPECTED_SUBCOMMANDS.auth ?? []) {
				expect(script).toContain(sub);
			}
		});

		test("includes all oracle subcommands including delete-session and 1m-usage", () => {
			const script = generateBashCompletions();
			for (const sub of EXPECTED_SUBCOMMANDS.oracle ?? []) {
				expect(script).toContain(sub);
			}
		});

		test("includes all sources subcommands (12 total)", () => {
			const script = generateBashCompletions();
			for (const sub of EXPECTED_SUBCOMMANDS.sources ?? []) {
				expect(script).toContain(sub);
			}
		});

		test("does not generate case entry for usage (no subcommands)", () => {
			const script = generateBashCompletions();
			// usage has no subcommands, so no case entry
			const lines = script.split("\n");
			const usageCaseLine = lines.find(
				(l) => l.trim().startsWith("usage)") && l.includes("COMPREPLY"),
			);
			expect(usageCaseLine).toBeUndefined();
		});

		test("contains installation instructions", () => {
			const script = generateBashCompletions();
			expect(script).toContain("~/.bashrc");
			expect(script).toContain("eval");
		});
	});

	// --- Zsh completions ---

	describe("zsh completions", () => {
		test("generates a compdef function", () => {
			const script = generateZshCompletions();
			expect(script).toContain("#compdef nia");
			expect(script).toContain("_nia()");
		});

		test("uses _describe for top-level commands", () => {
			const script = generateZshCompletions();
			expect(script).toContain("_describe");
		});

		test("uses compadd for subcommands", () => {
			const script = generateZshCompletions();
			expect(script).toContain("compadd");
		});

		test("handles CURRENT == 2 for top-level completion", () => {
			const script = generateZshCompletions();
			expect(script).toContain("CURRENT == 2");
		});

		test("includes all categories subcommands", () => {
			const script = generateZshCompletions();
			for (const sub of EXPECTED_SUBCOMMANDS.categories ?? []) {
				expect(script).toContain(sub);
			}
		});

		test("contains installation instructions", () => {
			const script = generateZshCompletions();
			expect(script).toContain("~/.zshrc");
			expect(script).toContain("eval");
		});
	});

	// --- Fish completions ---

	describe("fish completions", () => {
		test("disables file completions globally", () => {
			const script = generateFishCompletions();
			expect(script).toContain("complete -c nia -f");
		});

		test("uses __fish_use_subcommand for top-level", () => {
			const script = generateFishCompletions();
			expect(script).toContain("__fish_use_subcommand");
		});

		test("uses __fish_seen_subcommand_from for nested commands", () => {
			const script = generateFishCompletions();
			expect(script).toContain("__fish_seen_subcommand_from");
		});

		test("generates entries for all commands with subcommands", () => {
			const script = generateFishCompletions();
			const commandsWithSubs = ALL_TOP_COMMANDS.filter(
				(cmd) => (EXPECTED_SUBCOMMANDS[cmd]?.length ?? 0) > 0,
			);

			for (const cmd of commandsWithSubs) {
				expect(script).toContain(`__fish_seen_subcommand_from ${cmd}`);
			}
		});

		test("does not generate subcommand entries for usage (no subcommands)", () => {
			const script = generateFishCompletions();
			expect(script).not.toContain("__fish_seen_subcommand_from usage");
		});

		test("includes repos subcommands", () => {
			const script = generateFishCompletions();
			for (const sub of EXPECTED_SUBCOMMANDS.repos ?? []) {
				expect(script).toContain(`-a "${sub}"`);
			}
		});

		test("contains installation instructions", () => {
			const script = generateFishCompletions();
			expect(script).toContain("~/.config/fish/completions/nia.fish");
		});
	});

	// --- Cross-shell consistency ---

	describe("cross-shell consistency", () => {
		test("all three shells include the same top-level commands", () => {
			const bash = generateBashCompletions();
			const zsh = generateZshCompletions();
			const fish = generateFishCompletions();

			for (const cmd of ALL_TOP_COMMANDS) {
				expect(bash).toContain(cmd);
				expect(zsh).toContain(cmd);
				expect(fish).toContain(cmd);
			}
		});

		test("all three shells include oracle subcommands", () => {
			const bash = generateBashCompletions();
			const zsh = generateZshCompletions();
			const fish = generateFishCompletions();

			for (const sub of EXPECTED_SUBCOMMANDS.oracle ?? []) {
				expect(bash).toContain(sub);
				expect(zsh).toContain(sub);
				expect(fish).toContain(sub);
			}
		});

		test("all scripts are non-empty strings", () => {
			expect(generateBashCompletions().length).toBeGreaterThan(100);
			expect(generateZshCompletions().length).toBeGreaterThan(100);
			expect(generateFishCompletions().length).toBeGreaterThan(100);
		});
	});
});
