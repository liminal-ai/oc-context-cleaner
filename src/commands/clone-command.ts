import { defineCommand } from "citty";
import { getConfig } from "../config/get-config.js";
import { executeClone } from "../core/clone-operation-executor.js";
import { OccError } from "../errors.js";
import {
	formatCloneResultHuman,
	formatCloneResultJson,
} from "../output/result-formatter.js";
import type { CloneOptions } from "../types/index.js";

export const cloneCommand = defineCommand({
	meta: {
		name: "clone",
		description: "Clone a session to a new file",
	},
	args: {
		sessionId: {
			type: "positional",
			description: "Source session ID (or partial)",
			required: true,
		},
		"strip-tools": {
			type: "string",
			description:
				"Strip tool calls using preset (default, aggressive, extreme)",
		},
		output: {
			type: "string",
			alias: "o",
			description: "Output path for cloned session",
		},
		"no-register": {
			type: "boolean",
			description: "Skip session index registration",
			default: false,
		},
		agent: {
			type: "string",
			description: "Agent ID (default: auto-detect or 'main')",
		},
		json: {
			type: "boolean",
			description: "Output as JSON",
			default: false,
		},
		verbose: {
			type: "boolean",
			description: "Show detailed statistics",
			default: false,
		},
	},
	async run({ args }) {
		let outputFormat: "json" | "human" = "human";
		let verbose = false;
		try {
			const config = await getConfig();
			outputFormat = args.json ? "json" : config.outputFormat;
			verbose = args.verbose || config.verboseOutput;
			// Handle --strip-tools without value: citty sets it to true (boolean)
			const presetName =
				typeof args["strip-tools"] === "string"
					? args["strip-tools"]
					: config.defaultPreset;

			const options: CloneOptions = {
				sourceSessionId: args.sessionId as string,
				agentId: args.agent,
				outputPath: args.output,
				toolRemoval: args["strip-tools"]
					? { preset: presetName, customPresets: config.customPresets }
					: undefined,
				noRegister: args["no-register"],
				outputFormat,
				verbose,
			};

			const result = await executeClone(options);

			if (outputFormat === "json") {
				console.log(formatCloneResultJson(result));
			} else {
				console.log(formatCloneResultHuman(result, verbose));
			}

			process.exitCode = 0;
		} catch (error) {
			if (outputFormat === "json") {
				console.error(
					JSON.stringify({ success: false, error: (error as Error).message }),
				);
			} else {
				console.error(`Error: ${(error as Error).message}`);
				if (error instanceof OccError) {
					// Add resolution hints based on error type
					switch (error.code) {
						case "SESSION_NOT_FOUND":
							console.error("Hint: Use 'occ list' to see available sessions");
							break;
						case "AMBIGUOUS_SESSION":
							console.error(
								"Hint: Provide more characters of the session ID to disambiguate",
							);
							break;
						case "NO_SESSIONS":
							console.error(
								"Hint: No sessions exist for this agent. Check --agent flag or run a session first.",
							);
							break;
						case "AGENT_NOT_FOUND":
							console.error(
								"Hint: Use 'occ list' to see available agents, or omit --agent to use default",
							);
							break;
						case "UNKNOWN_PRESET":
							console.error(
								"Hint: Valid presets are: default, aggressive, extreme",
							);
							break;
						case "CLONE_FAILED":
							console.error(
								"Hint: Check file permissions and disk space. The source session is unchanged.",
							);
							break;
					}
				}
			}
			process.exitCode = 1;
		}
	},
});
