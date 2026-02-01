import { DEFAULT_AGENT_ID, DEFAULT_STATE_DIR } from "../io/paths.js";
import type { ResolvedConfiguration } from "../types/index.js";

export const DEFAULT_CONFIGURATION: ResolvedConfiguration = {
	stateDirectory: DEFAULT_STATE_DIR,
	defaultAgentId: DEFAULT_AGENT_ID,
	defaultPreset: "default",
	customPresets: {},
	outputFormat: "human",
	verboseOutput: false,
};
