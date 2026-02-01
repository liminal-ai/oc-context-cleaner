import { readFile, stat } from "node:fs/promises";
import type { SessionEntry, ParsedSession } from "../types/index.js";
import {
	parseJsonl,
	separateHeaderAndMessages,
} from "../core/session-parser.js";
import { SessionNotFoundError } from "../errors.js";

/**
 * Check if an error is an ENOENT (file not found) error.
 */
function isEnoentError(error: unknown): boolean {
	return (
		error instanceof Error &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === "ENOENT"
	);
}

/**
 * Read and parse a session file.
 *
 * @param filePath Path to the session JSONL file
 * @returns Parsed session with header and messages
 * @throws SessionNotFoundError if file does not exist
 */
export async function readSessionFile(
	filePath: string,
): Promise<ParsedSession> {
	const entries = await readSessionEntries(filePath);
	return separateHeaderAndMessages(entries, filePath);
}

/**
 * Read raw session entries without separating header.
 *
 * @param filePath Path to the session JSONL file
 * @returns Array of session entries
 * @throws SessionNotFoundError if file does not exist
 */
export async function readSessionEntries(
	filePath: string,
): Promise<SessionEntry[]> {
	try {
		const content = await readFile(filePath, "utf-8");
		return parseJsonl(content);
	} catch (error) {
		if (isEnoentError(error)) {
			throw new SessionNotFoundError(filePath);
		}
		throw new Error(
			`Failed to read session file '${filePath}': ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Get file statistics for a session file.
 *
 * @param filePath Path to the session file
 * @returns File size in bytes and modification time
 * @throws SessionNotFoundError if file does not exist
 */
export async function getSessionFileStats(
	filePath: string,
): Promise<{ sizeBytes: number; mtime: Date }> {
	try {
		const stats = await stat(filePath);
		return {
			sizeBytes: stats.size,
			mtime: stats.mtime,
		};
	} catch (error) {
		if (isEnoentError(error)) {
			throw new SessionNotFoundError(filePath);
		}
		throw new Error(
			`Failed to stat session file '${filePath}': ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
