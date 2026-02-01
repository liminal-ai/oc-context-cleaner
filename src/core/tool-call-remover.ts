import type {
	SessionEntry,
	MessageEntry,
	ResolvedToolRemovalOptions,
	ToolRemovalResult,
	ToolRemovalStatistics,
	TurnBoundary,
	ContentBlock,
} from "../types/index.js";
import { truncateArguments, truncateToolResult } from "../types/index.js";
import {
	identifyTurnBoundaries,
	getToolCallIds,
} from "./turn-boundary-calculator.js";
import { isSessionHeader, isMessageEntry } from "./session-parser.js";

/**
 * Remove/truncate tool calls from session entries based on preset rules.
 *
 * Algorithm:
 * 1. Identify turn boundaries
 * 2. Find turns with tool calls
 * 3. Classify: preserve (newest), truncate (middle), remove (oldest)
 * 4. Process entries accordingly
 * 5. Remove orphaned tool results
 * 6. Strip thinking blocks when any tools are touched
 *
 * @param entries Session entries (header + messages)
 * @param options Resolved tool removal options
 * @returns Processed entries and statistics
 */
export function removeToolCalls(
	entries: SessionEntry[],
	options: ResolvedToolRemovalOptions,
): ToolRemovalResult {
	// Separate header and messages
	const header = entries.find(isSessionHeader);
	const messages = entries.filter(isMessageEntry);

	// Identify turn boundaries
	const allTurns = identifyTurnBoundaries(messages);
	const turnsWithTools = allTurns.filter((t) => t.hasToolCalls);

	// Determine if we're touching any tools (for thinking block removal)
	const willTouchTools = turnsWithTools.length > 0;

	// Classify turns
	const classified = classifyTurns(turnsWithTools, options);

	// Build sets for quick lookup
	const removeTurnIndices = new Set(classified.remove);
	const truncateTurnIndices = new Set(classified.truncate);

	// Track which tool call IDs to keep
	const keptToolCallIds = new Set<string>();
	const processedMessages: MessageEntry[] = [];

	// Track count of individual tool calls truncated
	let toolCallsTruncatedCount = 0;

	// Track thinking blocks removed
	let thinkingBlocksRemoved = 0;

	// Process each message
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		const turn = allTurns.find((t) => i >= t.startIndex && i <= t.endIndex);

		if (!turn || !turn.hasToolCalls) {
			// No tools in this turn, keep as-is
			processedMessages.push(message);
			continue;
		}

		if (removeTurnIndices.has(turn.turnIndex)) {
			// Remove tool calls from this turn
			if (message.message.role === "toolResult") {
				// Skip tool results entirely
				continue;
			}
			const cleaned = removeToolCallsFromMessage(message);
			// Only add if there's content left
			if (hasContent(cleaned)) {
				processedMessages.push(cleaned);
			}
		} else if (truncateTurnIndices.has(turn.turnIndex)) {
			// Truncate tool calls in this turn
			if (message.message.role === "toolResult") {
				// Truncate tool result content
				const truncated = truncateToolResultMessage(message);
				processedMessages.push(truncated);
				if (message.message.toolCallId) {
					keptToolCallIds.add(message.message.toolCallId);
				}
			} else {
				const { message: truncated, truncatedCount } =
					truncateToolCallsInMessage(message);
				// Count individual tool calls that were truncated
				toolCallsTruncatedCount += truncatedCount;
				// Track kept tool call IDs
				for (const id of getToolCallIds(truncated)) {
					keptToolCallIds.add(id);
				}
				processedMessages.push(truncated);
			}
		} else {
			// Preserve at full fidelity
			processedMessages.push(message);
			if (message.message.role === "toolResult" && message.message.toolCallId) {
				keptToolCallIds.add(message.message.toolCallId);
			}
			for (const id of getToolCallIds(message)) {
				keptToolCallIds.add(id);
			}
		}
	}

	// Remove any orphaned tool references:
	// - Tool results without matching tool calls
	// - Tool calls without matching tool results (interrupted sessions)
	const finalMessages = processedMessages.filter((msg) => {
		if (msg.message.role === "toolResult" && msg.message.toolCallId) {
			return keptToolCallIds.has(msg.message.toolCallId);
		}
		return true;
	});

	// Collect IDs of all kept tool results
	const keptToolResultIds = new Set<string>();
	for (const msg of finalMessages) {
		if (msg.message.role === "toolResult" && msg.message.toolCallId) {
			keptToolResultIds.add(msg.message.toolCallId);
		}
	}

	// Remove orphaned tool calls (calls without results)
	// This handles interrupted sessions where a tool was called but never returned
	const cleanedMessages = finalMessages.map((msg) => {
		if (
			msg.message.role === "assistant" &&
			Array.isArray(msg.message.content)
		) {
			const filteredContent = msg.message.content.filter((block) => {
				if (block.type === "toolCall") {
					return keptToolResultIds.has(block.id);
				}
				return true;
			});
			// Only modify if we actually removed something
			if (filteredContent.length !== msg.message.content.length) {
				return {
					...msg,
					message: {
						...msg.message,
						content: filteredContent,
					},
				};
			}
		}
		return msg;
	});

	// Strip thinking blocks when any tools are touched
	// This reduces context size since thinking blocks are typically large
	const thinkingStrippedMessages = willTouchTools
		? cleanedMessages.map((msg) => {
				if (
					msg.message.role === "assistant" &&
					Array.isArray(msg.message.content)
				) {
					const originalLength = msg.message.content.length;
					const filteredContent = msg.message.content.filter((block) => {
						if (block.type === "thinking") {
							thinkingBlocksRemoved++;
							return false;
						}
						return true;
					});
					// Only create new object if we actually removed something
					if (filteredContent.length !== originalLength) {
						return {
							...msg,
							message: {
								...msg.message,
								content: filteredContent,
							},
						};
					}
				}
				return msg;
			})
		: cleanedMessages;

	// Build result entries
	const processedEntries: SessionEntry[] = header
		? [header, ...thinkingStrippedMessages]
		: thinkingStrippedMessages;

	// Calculate statistics
	const statistics = calculateStatistics(
		turnsWithTools,
		classified,
		messages,
		thinkingStrippedMessages,
		toolCallsTruncatedCount,
		thinkingBlocksRemoved,
	);

	return { processedEntries, statistics };
}

/**
 * Classify turns into preserve, truncate, or remove categories.
 *
 * @param turnsWithTools Turn boundaries that have tool calls
 * @param options Tool removal options
 * @returns Object with arrays of turn indices for each category
 */
export function classifyTurns(
	turnsWithTools: TurnBoundary[],
	options: ResolvedToolRemovalOptions,
): {
	preserve: number[];
	truncate: number[];
	remove: number[];
} {
	const { keepTurnsWithTools, truncatePercent } = options;

	// Sort by turn index (oldest first)
	const sorted = [...turnsWithTools].sort((a, b) => a.turnIndex - b.turnIndex);
	const total = sorted.length;

	// How many to remove (oldest)
	const keepCount = Math.min(keepTurnsWithTools, total);
	const removeCount = total - keepCount;

	// Of the kept, how many to truncate (oldest portion of kept)
	const truncateCount = Math.floor(keepCount * (truncatePercent / 100));
	// preserveCount = keepCount - truncateCount (used implicitly in the loop)

	// Classify
	const remove: number[] = [];
	const truncate: number[] = [];
	const preserve: number[] = [];

	for (let i = 0; i < sorted.length; i++) {
		const turnIndex = sorted[i].turnIndex;
		if (i < removeCount) {
			remove.push(turnIndex);
		} else if (i < removeCount + truncateCount) {
			truncate.push(turnIndex);
		} else {
			preserve.push(turnIndex);
		}
	}

	return { preserve, truncate, remove };
}

/**
 * Remove tool calls from a message entry entirely.
 * Returns the message with tool call blocks removed.
 */
export function removeToolCallsFromMessage(
	message: MessageEntry,
): MessageEntry {
	const content = message.message.content;
	if (typeof content === "string") return message;

	const filtered = content.filter((block) => block.type !== "toolCall");

	return {
		...message,
		message: {
			...message.message,
			content: filtered.length > 0 ? filtered : [{ type: "text", text: "" }],
		},
	};
}

/**
 * Truncate tool calls in a message entry.
 * Returns the message with tool call arguments truncated and count of truncations.
 */
export function truncateToolCallsInMessage(message: MessageEntry): {
	message: MessageEntry;
	truncatedCount: number;
} {
	const content = message.message.content;
	if (typeof content === "string") return { message, truncatedCount: 0 };

	let truncatedCount = 0;
	const processed: ContentBlock[] = content.map((block) => {
		if (block.type !== "toolCall") return block;

		// Truncate the arguments per tech-design:
		// 1. JSON.stringify the args
		// 2. Truncate the string to 120 chars / 2 lines
		// 3. Append "..." if truncated
		// 4. Store the truncated string directly
		const truncatedArgs = truncateArguments(block.arguments);
		const originalArgs = JSON.stringify(block.arguments);

		// Check if truncation actually occurred
		if (truncatedArgs !== originalArgs) {
			truncatedCount++;
		}

		return {
			...block,
			// Store truncated string directly (not wrapped in object)
			arguments: truncatedArgs as unknown as Record<string, unknown>,
		};
	});

	return {
		message: {
			...message,
			message: {
				...message.message,
				content: processed,
			},
		},
		truncatedCount,
	};
}

/**
 * Truncate tool result message content.
 */
function truncateToolResultMessage(message: MessageEntry): MessageEntry {
	const content = message.message.content;
	const truncated = truncateToolResult(content);

	return {
		...message,
		message: {
			...message.message,
			content: truncated,
		},
	};
}

/**
 * Check if a message has any meaningful content.
 */
function hasContent(message: MessageEntry): boolean {
	const content = message.message.content;
	if (typeof content === "string") return content.length > 0;
	return content.some((block) => {
		if (block.type === "text") return block.text.length > 0;
		return true;
	});
}

/**
 * Calculate statistics from the removal operation.
 */
function calculateStatistics(
	turnsWithTools: TurnBoundary[],
	classified: { preserve: number[]; truncate: number[]; remove: number[] },
	originalMessages: MessageEntry[],
	finalMessages: MessageEntry[],
	toolCallsTruncatedCount: number,
	thinkingBlocksRemoved: number,
): ToolRemovalStatistics {
	// Count tool calls in original
	let originalToolCalls = 0;
	for (const msg of originalMessages) {
		originalToolCalls += getToolCallIds(msg).length;
	}

	// Count tool calls in final
	let finalToolCalls = 0;
	for (const msg of finalMessages) {
		finalToolCalls += getToolCallIds(msg).length;
	}

	return {
		turnsWithToolsTotal: turnsWithTools.length,
		turnsWithToolsRemoved: classified.remove.length,
		turnsWithToolsTruncated: classified.truncate.length,
		turnsWithToolsPreserved: classified.preserve.length,
		toolCallsRemoved: originalToolCalls - finalToolCalls,
		toolCallsTruncated: toolCallsTruncatedCount,
		thinkingBlocksRemoved,
	};
}
