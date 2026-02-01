import type { ResolvedConfiguration } from "../types/index.js";
import { DEFAULT_STATE_DIR, DEFAULT_AGENT_ID } from "../io/paths.js";

export const DEFAULT_CONFIGURATION: ResolvedConfiguration = {
	stateDirectory: DEFAULT_STATE_DIR,
	defaultAgentId: DEFAULT_AGENT_ID,
	defaultPreset: "default",
	customPresets: {},
	outputFormat: "human",
	verboseOutput: false,
};
