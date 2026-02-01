import { defineCommand } from "citty";
import { resolveSessionId } from "../io/session-discovery.js";
import { restoreFromBackup } from "../core/backup-manager.js";
import { resolveAgentId } from "../io/paths.js";
import { RestoreError } from "../errors.js";

export const restoreCommand = defineCommand({
	meta: {
		name: "restore",
		description: "Restore session from backup",
	},
	args: {
		sessionId: {
			type: "positional",
			description: "Session ID (or partial)",
			required: true,
		},
		agent: {
			type: "string",
			description: "Agent ID (default: auto-detect or 'main')",
		},
	},
	async run({ args }) {
		try {
			const { getConfig } = await import("../config/get-config.js");
			const config = await getConfig();
			const agentId = resolveAgentId(args.agent, config.defaultAgentId);
			const sessionId = await resolveSessionId(
				args.sessionId as string,
				agentId,
				config.stateDirectory,
			);

			await restoreFromBackup(sessionId, agentId, config.stateDirectory);

			console.log(`Session '${sessionId}' restored from backup`);
			process.exitCode = 0;
		} catch (error) {
			console.error(`Error: ${(error as Error).message}`);
			if (error instanceof RestoreError) {
				console.error("No backup available for this session");
			}
			process.exitCode = 1;
		}
	},
});
