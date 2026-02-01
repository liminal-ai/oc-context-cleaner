import { defineCommand } from "citty";
import type { EditOptions } from "../types/index.js";
import { executeEdit } from "../core/edit-operation-executor.js";
import {
	formatEditResultHuman,
	formatEditResultJson,
} from "../output/result-formatter.js";
import { OccError } from "../errors.js";
import { getConfig } from "../config/get-config.js";

export const editCommand = defineCommand({
	meta: {
		name: "edit",
		description: "Edit a session in place with automatic backup",
	},
	args: {
		sessionId: {
			type: "positional",
			description:
				"Session ID (or partial). Omit to auto-detect current session.",
			required: false,
		},
		"strip-tools": {
			type: "string",
			description:
				"Strip tool calls using preset (default, aggressive, extreme)",
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
		try {
			const config = await getConfig();
			const outputFormat = args.json ? "json" : config.outputFormat;
			const verbose = args.verbose || config.verboseOutput;
			// Handle --strip-tools without value: citty sets it to true (boolean)
			const presetName =
				typeof args["strip-tools"] === "string"
					? args["strip-tools"]
					: config.defaultPreset;

			const options: EditOptions = {
				sessionId: args.sessionId as string | undefined,
				agentId: args.agent,
				toolRemoval: args["strip-tools"]
					? { preset: presetName, customPresets: config.customPresets }
					: undefined,
				outputFormat,
				verbose,
			};

			const result = await executeEdit(options);

			if (outputFormat === "json") {
				console.log(formatEditResultJson(result));
			} else {
				console.log(formatEditResultHuman(result, verbose));
			}

			process.exitCode = 0;
		} catch (error) {
			if (args.json) {
				console.log(
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
								"Hint: Check the agent ID with 'occ list --all-agents' or omit --agent to use default",
							);
							break;
						case "UNKNOWN_PRESET":
							console.error(
								"Hint: Valid presets are: default, aggressive, extreme",
							);
							break;
						case "EDIT_FAILED":
							console.error(
								"Hint: Check file permissions and disk space. The original session is unchanged.",
							);
							break;
					}
				}
			}
			process.exitCode = 1;
		}
	},
});
