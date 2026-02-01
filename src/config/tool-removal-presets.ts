import type {
	ToolRemovalPreset,
	ToolRemovalOptions,
	ResolvedToolRemovalOptions,
} from "../types/index.js";
import { UnknownPresetError } from "../errors.js";

export const BUILT_IN_PRESETS: Record<string, ToolRemovalPreset> = {
	default: {
		name: "default",
		keepTurnsWithTools: 20,
		truncatePercent: 50,
	},
	aggressive: {
		name: "aggressive",
		keepTurnsWithTools: 10,
		truncatePercent: 50,
	},
	extreme: {
		name: "extreme",
		keepTurnsWithTools: 0,
		truncatePercent: 0,
	},
};

/**
 * Resolve a preset by name.
 */
export function resolvePreset(
	name: string,
	customPresets?: Record<string, ToolRemovalPreset>,
): ToolRemovalPreset {
	// Check custom presets first
	if (customPresets?.[name]) {
		return customPresets[name];
	}

	// Check built-in presets
	if (BUILT_IN_PRESETS[name]) {
		return BUILT_IN_PRESETS[name];
	}

	throw new UnknownPresetError(name);
}

/**
 * Resolve tool removal options to concrete values.
 */
export function resolveToolRemovalOptions(
	options: ToolRemovalOptions,
): ResolvedToolRemovalOptions {
	const presetName = options.preset || "default";
	const preset = resolvePreset(presetName, options.customPresets);

	return {
		keepTurnsWithTools: options.keepTurnsWithTools ?? preset.keepTurnsWithTools,
		truncatePercent: options.truncatePercent ?? preset.truncatePercent,
	};
}
