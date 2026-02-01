import type { SessionInfo } from "../types/index.js";
import { formatFileSize } from "./result-formatter.js";

/**
 * Format session info for human output.
 */
export function formatSessionInfoHuman(info: SessionInfo): string {
	const lines: string[] = [];

	lines.push(`Session: ${info.sessionId}`);
	lines.push("");
	lines.push("Statistics:");
	lines.push(`  Total messages:     ${info.totalMessages}`);
	lines.push(`  User messages:      ${info.userMessages}`);
	lines.push(`  Assistant messages: ${info.assistantMessages}`);
	lines.push(`  Tool calls:         ${info.toolCalls}`);
	lines.push(`  Tool results:       ${info.toolResults}`);
	lines.push("");
	lines.push(`  Estimated tokens:   ${info.estimatedTokens.toLocaleString()}`);
	lines.push(`  File size:          ${formatFileSize(info.fileSizeBytes)}`);

	return lines.join("\n");
}

/**
 * Format session info for JSON output.
 */
export function formatSessionInfoJson(info: SessionInfo): string {
	return JSON.stringify(info, null, 2);
}
