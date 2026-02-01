import type {
	MessageEntry,
	ParsedSession,
	SessionEntry,
	SessionHeader,
} from "../types/index.js";
import { getToolCallIds } from "./turn-boundary-calculator.js";

/**
 * Result of JSONL parsing with potential errors.
 */
export interface ParseJsonlResult {
	entries: SessionEntry[];
	errors: ParseError[];
}

/**
 * Error encountered during JSONL parsing.
 */
export interface ParseError {
	lineNumber: number;
	line: string;
	error: string;
}

/**
 * Parse a JSONL string into session entries.
 * Skips malformed lines and collects errors instead of crashing.
 *
 * @param jsonl Raw JSONL content
 * @returns Object containing parsed entries and any errors encountered
 */
export function parseJsonlSafe(jsonl: string): ParseJsonlResult {
	const lines = jsonl.split("\n");
	const entries: SessionEntry[] = [];
	const errors: ParseError[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		try {
			entries.push(JSON.parse(line) as SessionEntry);
		} catch (err) {
			errors.push({
				lineNumber: i + 1,
				line: line.length > 100 ? `${line.slice(0, 100)}...` : line,
				error: (err as Error).message,
			});
		}
	}

	return { entries, errors };
}

/**
 * Parse a JSONL string into session entries.
 * Throws on first malformed line (legacy behavior).
 *
 * @param jsonl Raw JSONL content
 * @returns Array of session entries
 * @throws Error if any line is malformed JSON
 */
export function parseJsonl(jsonl: string): SessionEntry[] {
	const lines = jsonl.split("\n").filter((line) => line.trim());
	return lines.map((line, index) => {
		try {
			return JSON.parse(line) as SessionEntry;
		} catch (err) {
			throw new Error(
				`Malformed JSON at line ${index + 1}: ${(err as Error).message}`,
			);
		}
	});
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

/**
 * Count tool calls in session entries.
 *
 * @param entries Session entries to count
 * @returns Total number of tool calls
 */
export function countToolCalls(entries: readonly SessionEntry[]): number {
	let count = 0;
	for (const entry of entries) {
		if (isMessageEntry(entry)) {
			count += getToolCallIds(entry).length;
		}
	}
	return count;
}

/**
 * Tool statistics for operations.
 */
export interface ToolStats {
	original: number;
	removed: number;
	truncated: number;
	preserved: number;
}

/**
 * Base statistics calculated for any operation.
 */
export interface BaseOperationStatistics {
	messagesOriginal: number;
	messagesAfter: number;
	toolCallsOriginal: number;
	toolCallsRemoved: number;
	toolCallsTruncated: number;
	toolCallsPreserved: number;
	sizeOriginal: number;
	sizeAfter: number;
	reductionPercent: number;
}

/**
 * Calculate base operation statistics.
 *
 * @param originalSize Original file size in bytes
 * @param newSize New file size in bytes
 * @param originalMessages Original message count
 * @param newMessages New message count
 * @param toolStats Tool call statistics
 * @returns Calculated statistics
 */
export function calculateBaseStatistics(
	originalSize: number,
	newSize: number,
	originalMessages: number,
	newMessages: number,
	toolStats: ToolStats,
): BaseOperationStatistics {
	const reduction =
		originalSize > 0 ? ((originalSize - newSize) / originalSize) * 100 : 0;

	return {
		messagesOriginal: originalMessages,
		messagesAfter: newMessages,
		toolCallsOriginal: toolStats.original,
		toolCallsRemoved: toolStats.removed,
		toolCallsTruncated: toolStats.truncated,
		toolCallsPreserved: toolStats.preserved,
		sizeOriginal: originalSize,
		sizeAfter: newSize,
		reductionPercent: Math.max(0, reduction),
	};
}
