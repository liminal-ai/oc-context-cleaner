import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getConfig } from "../config/get-config.js";
import { resolveToolRemovalOptions } from "../config/tool-removal-presets.js";
import { CloneOperationError } from "../errors.js";
import {
	getSessionPath,
	getSessionsDirectory,
	resolveAgentId,
} from "../io/paths.js";
import { resolveSessionId } from "../io/session-discovery.js";
import {
	getSessionFileStats,
	readSessionEntries,
} from "../io/session-file-reader.js";
import { writeSessionFile } from "../io/session-file-writer.js";
import { addSessionToIndex } from "../io/session-index-writer.js";
import type {
	CloneOptions,
	CloneResult,
	CloneStatistics,
	SessionEntry,
	SessionHeader,
} from "../types/index.js";
import {
	calculateBaseStatistics,
	countToolCalls,
	isMessageEntry,
	isSessionHeader,
} from "./session-parser.js";
import { removeToolCalls } from "./tool-call-remover.js";

/**
 * Execute clone operation on a session.
 *
 * Creates new session file with new UUID, optionally strips tools,
 * optionally registers in session index.
 *
 * @param options Clone operation options
 * @returns Clone result with new session ID and statistics
 */
export async function executeClone(
	options: CloneOptions,
): Promise<CloneResult> {
	const config = await getConfig();
	const agentId = resolveAgentId(options.agentId, config.defaultAgentId);

	// Resolve source session ID (may be partial)
	const sourceSessionId = await resolveSessionId(
		options.sourceSessionId,
		agentId,
		config.stateDirectory,
	);
	const sourcePath = getSessionPath(
		sourceSessionId,
		agentId,
		config.stateDirectory,
	);
	const resolvedToolOptions = options.toolRemoval
		? resolveToolRemovalOptions(options.toolRemoval)
		: undefined;

	try {
		// Get original stats
		const originalStats = await getSessionFileStats(sourcePath);

		// Read source session
		const entries = await readSessionEntries(sourcePath);

		// Count original tool calls and messages
		const originalToolCalls = countToolCalls(entries);
		const originalMessages = entries.filter(isMessageEntry).length;

		// Apply tool removal if specified
		let processedEntries = entries;
		let toolStats = {
			original: originalToolCalls,
			removed: 0,
			truncated: 0,
			preserved: originalToolCalls,
		};

		// AC-5.x: Apply tool removal if specified
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
		// AC-4.7: Clone without --strip-tools preserves all content (no-op for tool removal)

		// Generate new session ID
		const newSessionId = generateSessionId();

		// Update session header
		processedEntries = updateSessionHeader(
			processedEntries,
			newSessionId,
			sourceSessionId,
		);

		// Determine output path
		const outputPath =
			options.outputPath ||
			join(
				getSessionsDirectory(agentId, config.stateDirectory),
				`${newSessionId}.jsonl`,
			);

		// Write cloned session
		await writeSessionFile(outputPath, processedEntries);

		// Get new stats
		const newStats = await getSessionFileStats(outputPath);
		const newMessages = processedEntries.filter(isMessageEntry).length;

		// Register in session index (unless --no-register)
		if (!options.noRegister) {
			await addSessionToIndex(
				newSessionId,
				agentId,
				{
					displayName: `Clone of ${sourceSessionId.slice(0, 8)}`,
				},
				config.stateDirectory,
			);
		}

		// Calculate statistics
		const baseStats = calculateBaseStatistics(
			originalStats.sizeBytes,
			newStats.sizeBytes,
			originalMessages,
			newMessages,
			toolStats,
		);
		const statistics: CloneStatistics = {
			messagesOriginal: baseStats.messagesOriginal,
			messagesCloned: baseStats.messagesAfter,
			toolCallsOriginal: baseStats.toolCallsOriginal,
			toolCallsRemoved: baseStats.toolCallsRemoved,
			toolCallsTruncated: baseStats.toolCallsTruncated,
			toolCallsPreserved: baseStats.toolCallsPreserved,
			sizeOriginal: baseStats.sizeOriginal,
			sizeCloned: baseStats.sizeAfter,
			reductionPercent: baseStats.reductionPercent,
		};

		return {
			success: true,
			mode: "clone",
			sourceSessionId,
			clonedSessionId: newSessionId,
			clonedSessionPath: outputPath,
			statistics,
			resumeCommand: `openclaw resume ${newSessionId}`,
		};
	} catch (error) {
		// All errors throw CloneOperationError for consistent handling
		// The caller (clone-command.ts) handles error display and hints
		throw new CloneOperationError(
			`Failed to clone session '${sourceSessionId}': ${(error as Error).message}`,
			error as Error,
		);
	}
}

/**
 * Generate a new session ID (UUID v4).
 */
export function generateSessionId(): string {
	return randomUUID();
}

/**
 * Update session header with new ID and clone metadata.
 */
function updateSessionHeader(
	entries: SessionEntry[],
	newSessionId: string,
	sourceSessionId: string,
): SessionEntry[] {
	return entries.map((entry) => {
		if (isSessionHeader(entry)) {
			return {
				...entry,
				id: newSessionId,
				clonedFrom: sourceSessionId,
				clonedAt: new Date().toISOString(),
			} as SessionHeader & { clonedFrom: string; clonedAt: string };
		}
		return entry;
	});
}
