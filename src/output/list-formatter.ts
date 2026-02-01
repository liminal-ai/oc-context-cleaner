import type { SessionIndexEntry } from "../types/index.js";

/**
 * Format session list for human output.
 */
export function formatSessionListHuman(sessions: SessionIndexEntry[]): string {
	if (sessions.length === 0) {
		return "No sessions found.";
	}

	const lines: string[] = [];
	lines.push("Sessions:");
	lines.push("");

	for (const session of sessions) {
		const id = truncateSessionId(session.sessionId);
		const time = formatRelativeTime(session.updatedAt);
		const projectPath = session.projectPath || session.cwd || "";

		if (projectPath) {
			lines.push(`  ${id}  ${time}  ${projectPath}`);
		} else {
			lines.push(`  ${id}  ${time}`);
		}
	}

	return lines.join("\n");
}

/**
 * Format session list for JSON output.
 */
export function formatSessionListJson(sessions: SessionIndexEntry[]): string {
	return JSON.stringify(sessions, null, 2);
}

/**
 * Format relative time (e.g., "2 hours ago").
 */
export function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 60) return "just now";
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
	if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

	const date = new Date(timestamp);
	return date.toLocaleDateString();
}

/**
 * Truncate session ID for display.
 */
export function truncateSessionId(
	sessionId: string,
	length: number = 12,
): string {
	if (sessionId.length <= length) {
		return sessionId;
	}
	return `${sessionId.slice(0, length)}...`;
}
