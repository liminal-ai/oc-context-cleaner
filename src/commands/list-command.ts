import { defineCommand } from "citty";
import { getConfig } from "../config/get-config.js";
import { AgentNotFoundError } from "../errors.js";
import { resolveAgentId } from "../io/paths.js";
import { agentExists, listAvailableAgents } from "../io/session-discovery.js";
import { getSessionsSortedByTime } from "../io/session-index-reader.js";
import {
	formatSessionListHuman,
	formatSessionListJson,
} from "../output/list-formatter.js";

export const listCommand = defineCommand({
	meta: {
		name: "list",
		description: "List available sessions",
	},
	args: {
		limit: {
			type: "string",
			alias: "n",
			description: "Limit number of results",
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
	},
	async run({ args }) {
		let outputFormat: "json" | "human" = "human";
		try {
			const config = await getConfig();
			outputFormat = args.json ? "json" : config.outputFormat;
			const agentId = resolveAgentId(args.agent, config.defaultAgentId);

			// Verify agent exists
			if (!(await agentExists(agentId, config.stateDirectory))) {
				const available = await listAvailableAgents(config.stateDirectory);
				throw new AgentNotFoundError(
					`Agent '${agentId}' not found`,
					available.length > 0 ? available : undefined,
				);
			}

			let sessions = await getSessionsSortedByTime(
				agentId,
				config.stateDirectory,
			);

			// Apply limit if specified
			if (args.limit) {
				const limit = parseInt(args.limit, 10);
				if (!Number.isNaN(limit) && limit > 0) {
					sessions = sessions.slice(0, limit);
				}
			}

			if (outputFormat === "json") {
				console.log(formatSessionListJson(sessions));
			} else {
				console.log(formatSessionListHuman(sessions));
			}

			process.exitCode = 0;
		} catch (error) {
			if (outputFormat === "json") {
				console.error(
					JSON.stringify({ success: false, error: (error as Error).message }),
				);
			} else {
				console.error(`Error: ${(error as Error).message}`);
				if (error instanceof AgentNotFoundError && error.availableAgents) {
					console.error(
						`Available agents: ${error.availableAgents.join(", ")}`,
					);
				}
			}
			process.exitCode = 1;
		}
	},
});
