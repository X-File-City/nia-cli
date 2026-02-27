import { defineCommand } from "@crustjs/core";

/**
 * The full command tree for shell completion generation.
 *
 * Maps each top-level command to its subcommands.
 */
const COMMAND_TREE: Record<string, string[]> = {
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

const TOP_COMMANDS = Object.keys(COMMAND_TREE);

/**
 * Generate a Bash completion script for the nia CLI.
 */
function generateBashCompletions(): string {
	const subcommandCases = TOP_COMMANDS.filter(
		(cmd) => (COMMAND_TREE[cmd]?.length ?? 0) > 0,
	)
		.map((cmd) => {
			const subs = COMMAND_TREE[cmd]?.join(" ") ?? "";
			return `        ${cmd}) COMPREPLY=( $(compgen -W "${subs}" -- "\${cur}") ) ;;`;
		})
		.join("\n");

	return `# Bash completion for nia CLI
# Add to ~/.bashrc or ~/.bash_profile:
#   eval "$(nia completions bash)"

_nia_completions() {
    local cur prev words cword
    _init_completion || return

    local commands="${TOP_COMMANDS.join(" ")}"

    if [[ \${cword} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
        return
    fi

    case "\${words[1]}" in
${subcommandCases}
    esac
}

complete -F _nia_completions nia
`;
}

/**
 * Generate a Zsh completion script for the nia CLI.
 */
function generateZshCompletions(): string {
	const subcommandCases = TOP_COMMANDS.filter(
		(cmd) => (COMMAND_TREE[cmd]?.length ?? 0) > 0,
	)
		.map((cmd) => {
			const subs = COMMAND_TREE[cmd]?.map((s) => `'${s}'`).join(" ") ?? "";
			return `            ${cmd}) compadd ${subs} ;;`;
		})
		.join("\n");

	return `#compdef nia
# Zsh completion for nia CLI
# Add to ~/.zshrc:
#   eval "$(nia completions zsh)"

_nia() {
    local -a commands
    commands=(${TOP_COMMANDS.map((c) => `'${c}'`).join(" ")})

    if (( CURRENT == 2 )); then
        _describe 'command' commands
        return
    fi

    case "\${words[2]}" in
${subcommandCases}
    esac
}

_nia "$@"
`;
}

/**
 * Generate a Fish completion script for the nia CLI.
 */
function generateFishCompletions(): string {
	const topCompletions = TOP_COMMANDS.map(
		(cmd) =>
			`complete -c nia -n "__fish_use_subcommand" -a "${cmd}" -d "${cmd} commands"`,
	).join("\n");

	const subCompletions = TOP_COMMANDS.filter(
		(cmd) => (COMMAND_TREE[cmd]?.length ?? 0) > 0,
	)
		.flatMap((cmd) =>
			(COMMAND_TREE[cmd] ?? []).map(
				(sub) =>
					`complete -c nia -n "__fish_seen_subcommand_from ${cmd}" -a "${sub}"`,
			),
		)
		.join("\n");

	return `# Fish completion for nia CLI
# Add to ~/.config/fish/completions/nia.fish:
#   nia completions fish > ~/.config/fish/completions/nia.fish

# Disable file completions for nia
complete -c nia -f

# Top-level commands
${topCompletions}

# Subcommands
${subCompletions}
`;
}

const bashCommand = defineCommand({
	meta: {
		name: "bash",
		description: "Generate Bash completions",
	},
	args: [],
	flags: {},
	run() {
		process.stdout.write(generateBashCompletions());
	},
});

const zshCommand = defineCommand({
	meta: {
		name: "zsh",
		description: "Generate Zsh completions",
	},
	args: [],
	flags: {},
	run() {
		process.stdout.write(generateZshCompletions());
	},
});

const fishCommand = defineCommand({
	meta: {
		name: "fish",
		description: "Generate Fish completions",
	},
	args: [],
	flags: {},
	run() {
		process.stdout.write(generateFishCompletions());
	},
});

export const completionsCommand = defineCommand({
	meta: {
		name: "completions",
		description: "Generate shell completion scripts",
	},
	subCommands: {
		bash: bashCommand,
		zsh: zshCommand,
		fish: fishCommand,
	},
});

// Exported for testing
export {
	generateBashCompletions,
	generateZshCompletions,
	generateFishCompletions,
};
