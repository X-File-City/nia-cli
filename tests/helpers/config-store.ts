import {
	configStore,
	getConfigDirPath,
	maskApiKey,
	type NiaConfig,
	resolveApiKey,
	resolveBaseUrl,
} from "../../src/services/config.ts";

export { getConfigDirPath, maskApiKey, resolveApiKey, resolveBaseUrl };

type LegacyConfig = NiaConfig & { output?: string };

export async function readConfig(): Promise<LegacyConfig> {
	return (await configStore.read()) as LegacyConfig;
}

export async function writeConfig(config: LegacyConfig): Promise<void> {
	const { output: _output, ...next } = config;
	return configStore.write(next as NiaConfig);
}

export async function updateConfig(
	updater: (current: LegacyConfig) => LegacyConfig,
): Promise<void> {
	return configStore.update((current) => {
		const next = updater(current as LegacyConfig);
		const { output: _output, ...persisted } = next;
		return persisted as NiaConfig;
	});
}

export async function resetConfig(): Promise<void> {
	return configStore.reset();
}
