import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "c12";
import type {
	ResolvedConfiguration,
	UserConfiguration,
} from "../types/index.js";
import { UserConfigurationSchema } from "./configuration-schema.js";
import { DEFAULT_CONFIGURATION } from "./default-configuration.js";

/**
 * Load configuration from all sources using c12.
 *
 * Priority (highest to lowest):
 * 1. CLI flags (not handled here)
 * 2. Environment variables
 * 3. Config file
 * 4. Defaults
 */
export async function loadConfiguration(): Promise<ResolvedConfiguration> {
	// Load from environment first (highest priority after CLI)
	const envConfig = loadFromEnvironment();

	// Use c12 to load config from standard locations
	const { config: fileConfig } = await loadConfig<UserConfiguration>({
		name: "occ",
		defaults: {},
		// c12 will check: occ.config.{js,ts,json}, .occrc, .occrc.json, package.json#occ
		rcFile: ".occrc",
		globalRc: true, // Check ~/.config/occ/ and ~/.occrc
	});

	// Validate file config if present
	let validatedFileConfig: UserConfiguration = {};
	if (fileConfig && Object.keys(fileConfig).length > 0) {
		const result = UserConfigurationSchema.safeParse(fileConfig);
		if (result.success) {
			validatedFileConfig = result.data;
		}
	}

	// Merge: defaults < file < environment
	const merged = mergeWithDefaults({
		...validatedFileConfig,
		...envConfig,
	});

	return merged;
}

/**
 * Merge user configuration with defaults.
 */
export function mergeWithDefaults(
	userConfig: UserConfiguration,
): ResolvedConfiguration {
	return {
		stateDirectory:
			userConfig.stateDirectory ?? DEFAULT_CONFIGURATION.stateDirectory,
		defaultAgentId:
			userConfig.defaultAgentId ?? DEFAULT_CONFIGURATION.defaultAgentId,
		defaultPreset:
			userConfig.defaultPreset ?? DEFAULT_CONFIGURATION.defaultPreset,
		customPresets: {
			...DEFAULT_CONFIGURATION.customPresets,
			...userConfig.customPresets,
		},
		outputFormat: userConfig.outputFormat ?? DEFAULT_CONFIGURATION.outputFormat,
		verboseOutput:
			userConfig.verboseOutput ?? DEFAULT_CONFIGURATION.verboseOutput,
	};
}

/**
 * Load configuration from environment variables.
 */
export function loadFromEnvironment(): Partial<UserConfiguration> {
	const config: Partial<UserConfiguration> = {};

	if (process.env.CLAWDBOT_STATE_DIR) {
		config.stateDirectory = process.env.CLAWDBOT_STATE_DIR;
	}

	if (process.env.CLAWDBOT_AGENT_ID) {
		config.defaultAgentId = process.env.CLAWDBOT_AGENT_ID;
	}

	if (process.env.OCC_PRESET) {
		config.defaultPreset = process.env.OCC_PRESET;
	}

	if (process.env.OCC_OUTPUT_FORMAT) {
		const format = process.env.OCC_OUTPUT_FORMAT;
		if (format === "json" || format === "human") {
			config.outputFormat = format;
		}
	}

	if (process.env.OCC_VERBOSE) {
		config.verboseOutput =
			process.env.OCC_VERBOSE === "true" || process.env.OCC_VERBOSE === "1";
	}

	return config;
}

/**
 * Get config file paths to check.
 * Note: c12 handles most of this, but we expose paths for testing.
 */
export function getConfigPaths(): string[] {
	const home = homedir();
	return [
		// XDG config (c12 globalRc checks this)
		join(
			process.env.XDG_CONFIG_HOME || join(home, ".config"),
			"occ",
			"config.json",
		),
		// Home directory rc files
		join(home, ".occrc.json"),
		join(home, ".occrc"),
		// Current directory (c12 checks these by default)
		join(process.cwd(), ".occrc.json"),
		join(process.cwd(), "occ.config.json"),
		join(process.cwd(), "occ.config.ts"),
		join(process.cwd(), "occ.config.js"),
	];
}
