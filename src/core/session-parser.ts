import type {
	SessionEntry,
	SessionHeader,
	MessageEntry,
	ParsedSession,
} from "../types/index.js";

/**
 * Parse a JSONL string into session entries.
 *
 * @param jsonl Raw JSONL content
 * @returns Array of session entries
 */
export function parseJsonl(jsonl: string): SessionEntry[] {
	const lines = jsonl.split("\n").filter((line) => line.trim());
	return lines.map((line) => JSON.parse(line) as SessionEntry);
}

/**
 * Serialize session entries to JSONL string.
 *
 * @param entries Session entries
 * @returns JSONL string
 */
export function serializeToJsonl(entries: SessionEntry[]): string {
	return `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

/**
 * Separate session header from message entries.
 *
 * @param entries All session entries
 * @returns Parsed session with header and messages separated
 */
export function separateHeaderAndMessages(
	entries: SessionEntry[],
	filePath: string,
): ParsedSession {
	const header = entries.find(isSessionHeader);
	if (!header) {
		throw new Error("Session file missing header");
	}

	const messages = entries.filter(isMessageEntry);

	return {
		header,
		messages,
		filePath,
	};
}

/**
 * Check if an entry is a session header.
 */
export function isSessionHeader(entry: SessionEntry): entry is SessionHeader {
	return entry.type === "session";
}

/**
 * Check if an entry is a message entry.
 */
export function isMessageEntry(entry: SessionEntry): entry is MessageEntry {
	return entry.type === "message";
}
