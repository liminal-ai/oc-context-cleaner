import { getConfig } from "../config/get-config.js";
import { resolveToolRemovalOptions } from "../config/tool-removal-presets.js";
import { EditOperationError } from "../errors.js";
import { getSessionPath, resolveAgentId } from "../io/paths.js";
import { resolveSessionId } from "../io/session-discovery.js";
import {
	getSessionFileStats,
	readSessionEntries,
} from "../io/session-file-reader.js";
import { writeSessionFile } from "../io/session-file-writer.js";
import { updateSessionTimestamp } from "../io/session-index-writer.js";
import type {
	EditOptions,
	EditResult,
	EditStatistics,
} from "../types/index.js";
import { createBackup } from "./backup-manager.js";
import {
	calculateBaseStatistics,
	countToolCalls,
	isMessageEntry,
} from "./session-parser.js";
import { removeToolCalls } from "./tool-call-remover.js";

/**
 * Execute edit operation on a session.
 *
 * Creates backup, applies tool stripping, writes back to original path.
 * Atomic operation--original unchanged if any step fails.
 *
 * @param options Edit operation options
 * @returns Edit result with statistics
 */
export async function executeEdit(options: EditOptions): Promise<EditResult> {
	const config = await getConfig();
	const agentId = resolveAgentId(options.agentId, config.defaultAgentId);

	// Resolve session ID (may auto-detect)
	const sessionId = await resolveSessionId(
		options.sessionId,
		agentId,
		config.stateDirectory,
	);
	const sessionPath = getSessionPath(sessionId, agentId, config.stateDirectory);
	const resolvedToolOptions = options.toolRemoval
		? resolveToolRemovalOptions(options.toolRemoval)
		: undefined;

	try {
		// Get original stats
		const originalStats = await getSessionFileStats(sessionPath);

		// Read session
		const entries = await readSessionEntries(sessionPath);

		// Count original tool calls
		const originalToolCalls = countToolCalls(entries);
		const originalMessages = entries.filter(isMessageEntry).length;

		// Create backup
		const backupPath = await createBackup(
			sessionPath,
			agentId,
			config.stateDirectory,
		);

		// Apply tool removal if specified
		let processedEntries = entries;
		let toolStats = {
			original: originalToolCalls,
			removed: 0,
			truncated: 0,
			preserved: originalToolCalls,
		};

		if (resolvedToolOptions) {
			const result = removeToolCalls(entries, resolvedToolOptions);
			processedEntries = result.processedEntries;

			toolStats = {
				original: originalToolCalls,
				removed: result.statistics.toolCallsRemoved,
				truncated: result.statistics.toolCallsTruncated,
				preserved:
					originalToolCalls -
					result.statistics.toolCallsRemoved -
					result.statistics.toolCallsTruncated,
			};
		}

		// Write modified session
		await writeSessionFile(sessionPath, processedEntries);

		// Update session index timestamp
		await updateSessionTimestamp(sessionId, agentId, config.stateDirectory);

		// Get new stats
		const newStats = await getSessionFileStats(sessionPath);
		const newMessages = processedEntries.filter(isMessageEntry).length;

		// Calculate statistics
		const baseStats = calculateBaseStatistics(
			originalStats.sizeBytes,
			newStats.sizeBytes,
			originalMessages,
			newMessages,
			toolStats,
		);
		const statistics: EditStatistics = {
			...baseStats,
		};

		return {
			success: true,
			mode: "edit",
			sessionId,
			backupPath,
			statistics,
		};
	} catch (error) {
		throw new EditOperationError(
			`Failed to edit session '${sessionId}': ${(error as Error).message}`,
			error as Error,
		);
	}
}
