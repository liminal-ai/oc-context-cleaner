import { writeFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { SessionsIndex, SessionIndexEntry } from "../types/index.js";
import { getSessionIndexPath } from "./paths.js";
import { readSessionIndex } from "./session-index-reader.js";

/**
 * Add a session to the index.
 *
 * Uses atomic write (temp + rename).
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 * @param metadata Optional metadata
 * @param stateDir Optional state directory override from config
 */
export async function addSessionToIndex(
	sessionId: string,
	agentId: string,
	metadata?: Partial<SessionIndexEntry>,
	stateDir?: string,
): Promise<void> {
	const index = await readSessionIndex(agentId, stateDir);

	index[sessionId] = {
		sessionId,
		updatedAt: Date.now(),
		...metadata,
	};

	await writeIndexAtomic(agentId, index, stateDir);
}

/**
 * Update a session's timestamp in the index.
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 * @param stateDir Optional state directory override from config
 */
export async function updateSessionTimestamp(
	sessionId: string,
	agentId: string,
	stateDir?: string,
): Promise<void> {
	const index = await readSessionIndex(agentId, stateDir);

	if (index[sessionId]) {
		index[sessionId].updatedAt = Date.now();
		await writeIndexAtomic(agentId, index, stateDir);
	}
}

/**
 * Write index file atomically.
 */
async function writeIndexAtomic(
	agentId: string,
	index: SessionsIndex,
	stateDir?: string,
): Promise<void> {
	const indexPath = getSessionIndexPath(agentId, stateDir);
	const dir = dirname(indexPath);
	const tempPath = join(dir, `.tmp-${randomUUID()}.json`);

	const content = JSON.stringify(index, null, 2);

	try {
		await writeFile(tempPath, content, "utf-8");
		await rename(tempPath, indexPath);
	} catch (error) {
		try {
			await unlink(tempPath);
		} catch {
			// Ignore cleanup errors
		}
		throw error;
	}
}
