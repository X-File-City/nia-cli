import { defineCommand } from "@crustjs/core";
import {
	ALL_CONFIG_KEYS,
	isConfigKey,
	isSettableKey,
	maskApiKey,
	readConfig,
	updateConfig,
} from "../services/config.ts";

const setCommand = defineCommand({
	meta: {
		name: "set",
		description: "Set a configuration value",
	},
	args: [
		{
			name: "key",
			type: "string",
			description: "Config key (output, baseUrl)",
			required: true,
		},
		{
			name: "value",
			type: "string",
			description: "Value to set",
			required: true,
		},
	] as const,
	async run({ args }) {
		const { key, value } = args;

		if (key === "apiKey") {
			console.log("Use `nia auth login` to set your API key.");
			return;
		}

		if (!isSettableKey(key)) {
			console.error(
				`Unknown config key: "${key}". Allowed keys: output, baseUrl`,
			);
			process.exit(1);
		}

		if (key === "output" && !["json", "table", "text"].includes(value)) {
			console.error(
				`Invalid output format: "${value}". Allowed values: json, table, text`,
			);
			process.exit(1);
		}

		await updateConfig((config) => ({
			...config,
			[key]: value,
		}));

		console.log(`Set ${key} = ${value}`);
	},
});

const getCommand = defineCommand({
	meta: {
		name: "get",
		description: "Get a configuration value",
	},
	args: [
		{
			name: "key",
			type: "string",
			description: "Config key to read",
			required: true,
		},
	] as const,
	async run({ args }) {
		const { key } = args;

		if (!isConfigKey(key)) {
			console.error(
				`Unknown config key: "${key}". Valid keys: ${ALL_CONFIG_KEYS.join(", ")}`,
			);
			process.exit(1);
		}

		const config = await readConfig();
		const value = config[key];

		if (key === "apiKey") {
			console.log(maskApiKey(value));
		} else {
			console.log(value ?? "(not set)");
		}
	},
});

const listCommand = defineCommand({
	meta: {
		name: "list",
		description: "Display all configuration values",
	},
	async run() {
		const config = await readConfig();

		for (const key of ALL_CONFIG_KEYS) {
			const value = config[key];
			const display =
				key === "apiKey" ? maskApiKey(value) : (value ?? "(not set)");
			console.log(`${key} = ${display}`);
		}
	},
});

export const configCommand = defineCommand({
	meta: {
		name: "config",
		description: "Manage CLI configuration",
	},
	subCommands: {
		set: setCommand,
		get: getCommand,
		list: listCommand,
	},
});
