import { defineCommand } from "citty";
import { getConfig } from "../config/get-config.js";
import { OccError } from "../errors.js";
import { getSessionPath, resolveAgentId } from "../io/paths.js";
import { resolveSessionId } from "../io/session-discovery.js";
import {
	getSessionFileStats,
	readSessionFile,
} from "../io/session-file-reader.js";
import {
	formatSessionInfoHuman,
	formatSessionInfoJson,
} from "../output/info-formatter.js";
import type { MessageEntry, SessionInfo } from "../types/index.js";

export const infoCommand = defineCommand({
	meta: {
		name: "info",
		description: "Show session statistics",
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
			const sessionId = await resolveSessionId(
				args.sessionId as string,
				agentId,
				config.stateDirectory,
			);
			const sessionPath = getSessionPath(
				sessionId,
				agentId,
				config.stateDirectory,
			);

			const parsed = await readSessionFile(sessionPath);
			const stats = await getSessionFileStats(sessionPath);

			const info = analyzeSession(sessionId, parsed.messages, stats.sizeBytes);

			if (outputFormat === "json") {
				console.log(formatSessionInfoJson(info));
			} else {
				console.log(formatSessionInfoHuman(info));
			}

			process.exitCode = 0;
		} catch (error) {
			if (outputFormat === "json") {
				console.error(
					JSON.stringify({ success: false, error: (error as Error).message }),
				);
			} else {
				console.error(`Error: ${(error as Error).message}`);
				if (error instanceof OccError && error.code === "SESSION_NOT_FOUND") {
					console.error("Use 'occ list' to see available sessions");
				}
			}
			process.exitCode = 1;
		}
	},
});

/**
 * Analyze session and return statistics.
 */
function analyzeSession(
	sessionId: string,
	messages: MessageEntry[],
	fileSizeBytes: number,
): SessionInfo {
	let userMessages = 0;
	let assistantMessages = 0;
	let toolCalls = 0;
	let toolResults = 0;
	let totalChars = 0;

	for (const entry of messages) {
		const role = entry.message.role;
		const content = entry.message.content;

		if (role === "user") {
			userMessages++;
		} else if (role === "assistant") {
			assistantMessages++;
		} else if (role === "toolResult") {
			toolResults++;
		}

		// Count tool calls
		if (typeof content !== "string") {
			for (const block of content) {
				if (block.type === "toolCall") {
					toolCalls++;
				}
				if (block.type === "text") {
					totalChars += block.text.length;
				}
			}
		} else {
			totalChars += content.length;
		}
	}

	// Estimate tokens (~4 chars per token)
	const estimatedTokens = Math.round(totalChars / 4);

	return {
		sessionId,
		totalMessages: messages.length,
		userMessages,
		assistantMessages,
		toolCalls,
		toolResults,
		estimatedTokens,
		fileSizeBytes,
	};
}
