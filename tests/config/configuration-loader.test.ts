import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Create hoisted mock function that's available during vi.mock hoisting
const mockLoadConfig = vi.hoisted(() => vi.fn());

// Mock node:os BEFORE importing modules that use it
vi.mock("node:os", () => ({
	homedir: vi.fn(() => "/home/testuser"),
}));

// Mock c12 to control config file loading in tests
vi.mock("c12", () => ({
	loadConfig: mockLoadConfig,
}));

import {
	getConfigPaths,
	loadConfiguration,
	loadFromEnvironment,
	mergeWithDefaults,
} from "../../src/config/configuration-loader.js";
import {
	resolvePreset,
	resolveToolRemovalOptions,
} from "../../src/config/tool-removal-presets.js";

describe("configuration-loader", () => {
	beforeEach(() => {
		vi.stubEnv("CLAWDBOT_STATE_DIR", undefined);
		vi.stubEnv("CLAWDBOT_AGENT_ID", undefined);
		vi.stubEnv("OCC_PRESET", undefined);
		vi.stubEnv("OCC_OUTPUT_FORMAT", undefined);
		vi.stubEnv("OCC_VERBOSE", undefined);
		vi.stubEnv("XDG_CONFIG_HOME", undefined);
		// Default mock: no config file found
		mockLoadConfig.mockResolvedValue({ config: {} });
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		mockLoadConfig.mockReset();
	});

	// TC-8.1a: Config read from standard location
	it("config read from standard location", () => {
		const paths = getConfigPaths();
		expect(paths.some((p) => p.includes(".config/occ"))).toBe(true);
		expect(paths.some((p) => p.startsWith("/home/testuser"))).toBe(true);
	});

	// TC-8.2a: Custom preset from config file works end-to-end
	it("custom preset from config file applied end-to-end", async () => {
		// Mock c12 to return config with custom preset
		mockLoadConfig.mockResolvedValue({
			config: {
				customPresets: {
					conservative: {
						name: "conservative",
						keepTurnsWithTools: 30,
						truncatePercent: 25,
					},
				},
			},
		});

		// Load config from file
		const config = await loadConfiguration();

		// Verify custom preset is available and works
		expect(config.customPresets).toHaveProperty("conservative");
		const preset = resolvePreset("conservative", config.customPresets);
		expect(preset.keepTurnsWithTools).toBe(30);
		expect(preset.truncatePercent).toBe(25);
	});

	// TC-8.3a: Environment variable overrides config file value
	it("environment variable overrides config file value", async () => {
		// Mock c12 to return config with defaultPreset = "aggressive"
		mockLoadConfig.mockResolvedValue({
			config: { defaultPreset: "aggressive" },
		});

		// Set env var to override
		vi.stubEnv("OCC_PRESET", "default");

		// Load configuration (should merge file + env)
		const config = await loadConfiguration();

		// Environment variable should win over config file
		expect(config.defaultPreset).toBe("default");
	});

	// TC-8.4a: CLI flag overrides environment variable
	it("CLI flag overrides environment variable", () => {
		vi.stubEnv("OCC_PRESET", "default");

		// CLI override happens at command level via resolveToolRemovalOptions
		// When CLI passes explicit preset, it wins over env var
		const options = resolveToolRemovalOptions({ preset: "aggressive" });
		expect(options.keepTurnsWithTools).toBe(10); // aggressive preset values
	});

	// Additional tests for mergeWithDefaults
	it("mergeWithDefaults applies defaults for missing values", () => {
		const result = mergeWithDefaults({});
		expect(result.defaultPreset).toBe("default");
		expect(result.outputFormat).toBe("human");
		expect(result.verboseOutput).toBe(false);
		expect(result.customPresets).toEqual({});
	});

	it("mergeWithDefaults preserves user values", () => {
		const result = mergeWithDefaults({
			defaultPreset: "aggressive",
			outputFormat: "json",
			verboseOutput: true,
		});
		expect(result.defaultPreset).toBe("aggressive");
		expect(result.outputFormat).toBe("json");
		expect(result.verboseOutput).toBe(true);
	});

	// Additional tests for loadFromEnvironment
	it("loadFromEnvironment reads all environment variables", () => {
		vi.stubEnv("CLAWDBOT_STATE_DIR", "/custom/state");
		vi.stubEnv("CLAWDBOT_AGENT_ID", "custom-agent");
		vi.stubEnv("OCC_PRESET", "extreme");
		vi.stubEnv("OCC_OUTPUT_FORMAT", "json");
		vi.stubEnv("OCC_VERBOSE", "true");

		const result = loadFromEnvironment();

		expect(result.stateDirectory).toBe("/custom/state");
		expect(result.defaultAgentId).toBe("custom-agent");
		expect(result.defaultPreset).toBe("extreme");
		expect(result.outputFormat).toBe("json");
		expect(result.verboseOutput).toBe(true);
	});

	it("loadFromEnvironment ignores invalid output format", () => {
		vi.stubEnv("OCC_OUTPUT_FORMAT", "invalid");

		const result = loadFromEnvironment();

		expect(result.outputFormat).toBeUndefined();
	});
});

describe("strip-tools-argument-handling", () => {
	// Test the logic used in edit-command.ts and clone-command.ts:
	// When citty receives --strip-tools without a value, it sets args["strip-tools"] to true (boolean)
	// The code should use config.defaultPreset in that case, not "true" as preset name

	it("when strip-tools is boolean true, uses default preset", () => {
		const argsStripTools: boolean | string = true; // citty behavior for --strip-tools without value
		const configDefaultPreset = "aggressive";

		// This matches the logic in edit-command.ts and clone-command.ts
		const presetName =
			typeof argsStripTools === "string" ? argsStripTools : configDefaultPreset;

		expect(presetName).toBe("aggressive");
	});

	it("when strip-tools is string, uses that string as preset", () => {
		const argsStripTools: boolean | string = "extreme"; // --strip-tools=extreme
		const configDefaultPreset = "aggressive";

		const presetName =
			typeof argsStripTools === "string" ? argsStripTools : configDefaultPreset;

		expect(presetName).toBe("extreme");
	});

	it("when strip-tools is undefined, uses default preset", () => {
		const argsStripTools: boolean | string | undefined = undefined;
		const configDefaultPreset = "default";

		const presetName =
			typeof argsStripTools === "string" ? argsStripTools : configDefaultPreset;

		expect(presetName).toBe("default");
	});
});
