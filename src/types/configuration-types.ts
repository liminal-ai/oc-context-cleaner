import type { ToolRemovalPreset } from "./tool-removal-types.js";

/**
 * User-provided configuration (partial, merged with defaults).
 */
export interface UserConfiguration {
	/** Override state directory (default: ~/.clawdbot) */
	stateDirectory?: string;
	/** Default agent ID (default: "main") */
	defaultAgentId?: string;
	/** Default preset name when --strip-tools has no value */
	defaultPreset?: string;
	/** Custom preset definitions */
	customPresets?: Record<string, ToolRemovalPreset>;
	/** Default output format */
	outputFormat?: "human" | "json";
	/** Enable verbose output by default */
	verboseOutput?: boolean;
}

/**
 * Fully resolved configuration (all values present).
 */
export interface ResolvedConfiguration {
	stateDirectory: string;
	defaultAgentId: string;
	defaultPreset: string;
	customPresets: Record<string, ToolRemovalPreset>;
	outputFormat: "human" | "json";
	verboseOutput: boolean;
}
