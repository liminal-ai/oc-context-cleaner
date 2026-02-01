import { readdir, unlink } from "node:fs/promises";
import { RestoreError } from "../errors.js";
import {
	getBackupPath,
	getSessionPath,
	getSessionsDirectory,
} from "../io/paths.js";
import { copyFileAtomic } from "../io/session-file-writer.js";

const MAX_BACKUPS = 5;

/**
 * Create a backup of a session file.
 *
 * Uses monotonic numbering. Rotates to keep max 5 backups.
 *
 * @param sessionPath Path to session file
 * @param agentId Agent ID
 * @param stateDir Optional state directory override from config
 * @returns Path to created backup
 */
export async function createBackup(
	sessionPath: string,
	agentId: string,
	stateDir?: string,
): Promise<string> {
	// Extract session ID from path
	const sessionId = sessionPath.split("/").pop()?.replace(".jsonl", "") || "";

	// Get existing backup numbers
	const existingNumbers = await getBackupNumbers(sessionId, agentId, stateDir);

	// Determine next backup number
	const nextNumber =
		existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

	// Create backup
	const backupPath = getBackupPath(sessionId, nextNumber, agentId, stateDir);
	await copyFileAtomic(sessionPath, backupPath);

	// Rotate if needed
	await rotateBackups(sessionId, agentId, MAX_BACKUPS, stateDir);

	return backupPath;
}

/**
 * Find the most recent backup for a session.
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 * @param stateDir Optional state directory override from config
 * @returns Path to most recent backup, or null if none
 */
export async function findLatestBackup(
	sessionId: string,
	agentId: string,
	stateDir?: string,
): Promise<string | null> {
	const numbers = await getBackupNumbers(sessionId, agentId, stateDir);

	if (numbers.length === 0) {
		return null;
	}

	const maxNumber = Math.max(...numbers);
	return getBackupPath(sessionId, maxNumber, agentId, stateDir);
}

/**
 * Restore a session from its most recent backup.
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 * @param stateDir Optional state directory override from config
 * @throws RestoreError if no backup exists
 */
export async function restoreFromBackup(
	sessionId: string,
	agentId: string,
	stateDir?: string,
): Promise<void> {
	const backupPath = await findLatestBackup(sessionId, agentId, stateDir);

	if (!backupPath) {
		throw new RestoreError(`No backup found for session '${sessionId}'`);
	}

	const sessionPath = getSessionPath(sessionId, agentId, stateDir);
	await copyFileAtomic(backupPath, sessionPath);
}

/**
 * Get all backup numbers for a session.
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 * @param stateDir Optional state directory override from config
 * @returns Array of backup numbers, sorted ascending
 */
export async function getBackupNumbers(
	sessionId: string,
	agentId: string,
	stateDir?: string,
): Promise<number[]> {
	const sessionsDir = getSessionsDirectory(agentId, stateDir);

	try {
		const files = await readdir(sessionsDir);
		const backupPattern = new RegExp(
			`^${escapeRegExp(sessionId)}\\.backup\\.(\\d+)\\.jsonl$`,
		);

		const numbers: number[] = [];
		for (const file of files) {
			const match = file.match(backupPattern);
			if (match) {
				numbers.push(parseInt(match[1], 10));
			}
		}

		return numbers.sort((a, b) => a - b);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

/**
 * Rotate backups to maintain max count.
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 * @param maxBackups Maximum backups to keep (default 5)
 * @param stateDir Optional state directory override from config
 */
export async function rotateBackups(
	sessionId: string,
	agentId: string,
	maxBackups: number = MAX_BACKUPS,
	stateDir?: string,
): Promise<void> {
	const numbers = await getBackupNumbers(sessionId, agentId, stateDir);

	if (numbers.length <= maxBackups) {
		return;
	}

	// Delete oldest backups
	const toDelete = numbers.slice(0, numbers.length - maxBackups);

	for (const num of toDelete) {
		const path = getBackupPath(sessionId, num, agentId, stateDir);
		try {
			await unlink(path);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw error;
			}
		}
	}
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
