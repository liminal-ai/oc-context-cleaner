import type {
	EditOptions,
	EditResult,
	EditStatistics,
	SessionEntry,
} from "../types/index.js";
import { resolveSessionId } from "../io/session-discovery.js";
import {
	readSessionEntries,
	getSessionFileStats,
} from "../io/session-file-reader.js";
import { writeSessionFile } from "../io/session-file-writer.js";
import { getSessionPath, resolveAgentId } from "../io/paths.js";
import { createBackup } from "./backup-manager.js";
import { removeToolCalls } from "./tool-call-remover.js";
import { resolveToolRemovalOptions } from "../config/tool-removal-presets.js";
import { getConfig } from "../config/get-config.js";
import { EditOperationError } from "../errors.js";
import { isMessageEntry } from "./session-parser.js";
import { getToolCallIds } from "./turn-boundary-calculator.js";

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
				preserved: originalToolCalls - result.statistics.toolCallsRemoved,
			};
		}

		// Write modified session
		await writeSessionFile(sessionPath, processedEntries);

		// Get new stats
		const newStats = await getSessionFileStats(sessionPath);
		const newMessages = processedEntries.filter(isMessageEntry).length;

		// Calculate statistics
		const statistics = calculateEditStatistics(
			originalStats.sizeBytes,
			newStats.sizeBytes,
			originalMessages,
			newMessages,
			toolStats,
		);

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

/**
 * Calculate statistics for edit operation.
 */
export function calculateEditStatistics(
	originalSize: number,
	newSize: number,
	originalMessages: number,
	newMessages: number,
	toolStats: {
		original: number;
		removed: number;
		truncated: number;
		preserved: number;
	},
): EditStatistics {
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

/**
 * Count tool calls in entries.
 */
function countToolCalls(entries: readonly SessionEntry[]): number {
	let count = 0;
	for (const entry of entries) {
		if (isMessageEntry(entry)) {
			count += getToolCallIds(entry).length;
		}
	}
	return count;
}
