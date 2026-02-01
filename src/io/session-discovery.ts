import { access, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
	AgentNotFoundError,
	AmbiguousSessionError,
	NoSessionsError,
	SessionNotFoundError,
} from "../errors.js";
import {
	getSessionPath,
	getSessionsDirectory,
	getStateDirectory,
	resolveAgentId,
} from "./paths.js";

/**
 * Resolve a session ID (full, partial, or auto-detect).
 *
 * Resolution order:
 * 1. If undefined, return most-recently-modified session
 * 2. If exact match exists, return it
 * 3. If partial match is unique, return it
 * 4. If ambiguous, throw with matching sessions
 *
 * @param sessionId Session ID or partial, or undefined for auto
 * @param agentId Agent ID
 * @param stateDir Optional state directory override from config
 * @returns Full session ID
 */
export async function resolveSessionId(
	sessionId: string | undefined,
	agentId?: string,
	stateDir?: string,
): Promise<string> {
	const resolvedAgent = resolveAgentId(agentId);

	// Verify agent exists
	if (!(await agentExists(resolvedAgent, stateDir))) {
		const available = await listAvailableAgents(stateDir);
		throw new AgentNotFoundError(
			`Agent '${resolvedAgent}' not found`,
			available.length > 0 ? available : undefined,
		);
	}

	// Auto-detect if no session ID provided
	if (!sessionId) {
		return getCurrentSession(resolvedAgent, stateDir);
	}

	// Try exact match first
	const exactPath = getSessionPath(sessionId, resolvedAgent, stateDir);
	try {
		await access(exactPath);
		return sessionId;
	} catch {
		// Not an exact match, try partial
	}

	// Try partial match
	const matches = await findMatchingSessions(
		sessionId,
		resolvedAgent,
		stateDir,
	);

	if (matches.length === 0) {
		throw new SessionNotFoundError(sessionId);
	}

	if (matches.length === 1) {
		return matches[0];
	}

	throw new AmbiguousSessionError(sessionId, matches);
}

/**
 * Get the current session (most recently modified).
 *
 * Prefers filesystem mtime scan for accuracy, since the index
 * may not reflect recent edits from external tools.
 *
 * @param agentId Agent ID
 * @param stateDir Optional state directory override from config
 * @returns Session ID of most recent session
 */
export async function getCurrentSession(
	agentId: string,
	stateDir?: string,
): Promise<string> {
	// Prefer filesystem scan for accurate mtime detection
	const sessionsDir = getSessionsDirectory(agentId, stateDir);
	try {
		const files = await readdir(sessionsDir);
		const jsonlFiles = files.filter(
			(f) => f.endsWith(".jsonl") && !f.includes(".backup."),
		);

		if (jsonlFiles.length === 0) {
			throw new NoSessionsError(agentId);
		}

		// Get mtimes and sort
		const withStats = await Promise.all(
			jsonlFiles.map(async (file) => {
				const path = join(sessionsDir, file);
				const stats = await stat(path);
				return { file, mtime: stats.mtime };
			}),
		);

		withStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

		// Return session ID (filename without .jsonl)
		return withStats[0].file.replace(".jsonl", "");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new NoSessionsError(agentId);
		}
		throw error;
	}
}

/**
 * Find sessions matching a partial ID.
 *
 * @param partial Partial session ID
 * @param agentId Agent ID
 * @param stateDir Optional state directory override from config
 * @returns Array of matching session IDs
 */
export async function findMatchingSessions(
	partial: string,
	agentId: string,
	stateDir?: string,
): Promise<string[]> {
	const sessionsDir = getSessionsDirectory(agentId, stateDir);

	try {
		const files = await readdir(sessionsDir);
		const jsonlFiles = files.filter(
			(f) => f.endsWith(".jsonl") && !f.includes(".backup."),
		);

		const matches: string[] = [];
		for (const file of jsonlFiles) {
			const sessionId = file.replace(".jsonl", "");
			if (sessionId.startsWith(partial)) {
				matches.push(sessionId);
			}
		}

		return matches;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

/**
 * List available agents.
 *
 * @param stateDir Optional state directory override from config
 * @returns Array of agent IDs
 */
export async function listAvailableAgents(
	stateDir?: string,
): Promise<string[]> {
	const agentsDir = join(getStateDirectory(stateDir), "agents");

	try {
		const entries = await readdir(agentsDir, { withFileTypes: true });
		return entries.filter((e) => e.isDirectory()).map((e) => e.name);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

/**
 * Check if an agent exists.
 *
 * @param agentId Agent ID
 * @param stateDir Optional state directory override from config
 * @returns True if agent exists
 */
export async function agentExists(
	agentId: string,
	stateDir?: string,
): Promise<boolean> {
	const sessionsDir = getSessionsDirectory(agentId, stateDir);

	try {
		await access(sessionsDir);
		return true;
	} catch {
		return false;
	}
}
