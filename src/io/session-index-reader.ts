import { readFile } from "node:fs/promises";
import type { SessionIndexEntry, SessionsIndex } from "../types/index.js";
import { getSessionIndexPath } from "./paths.js";

/**
 * Read the session index for an agent.
 *
 * @param agentId Agent ID
 * @param stateDir Optional state directory override from config
 * @returns Session index object
 */
export async function readSessionIndex(
	agentId: string,
	stateDir?: string,
): Promise<SessionsIndex> {
	const indexPath = getSessionIndexPath(agentId, stateDir);
	try {
		const content = await readFile(indexPath, "utf-8");
		return JSON.parse(content) as SessionsIndex;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return {}; // No index file yet
		}
		throw error;
	}
}

/**
 * Get session entries sorted by modification time (newest first).
 *
 * @param agentId Agent ID
 * @param stateDir Optional state directory override from config
 * @returns Array of session index entries
 */
export async function getSessionsSortedByTime(
	agentId: string,
	stateDir?: string,
): Promise<SessionIndexEntry[]> {
	const index = await readSessionIndex(agentId, stateDir);
	const entries = Object.values(index);
	return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}
