import type {
	MessageEntry,
	TurnBoundary,
	ToolCallBlock,
} from "../types/index.js";

/**
 * Identify turn boundaries in session entries.
 *
 * A turn starts when a user sends text content (not a tool result)
 * and ends at the final assistant message before the next user turn.
 *
 * @param messages Session message entries (excluding header)
 * @returns Array of turn boundaries
 */
export function identifyTurnBoundaries(
	messages: MessageEntry[],
): TurnBoundary[] {
	const boundaries: TurnBoundary[] = [];
	let currentTurnStart: number | null = null;
	let turnIndex = 0;
	let hasToolCallsInTurn = false;

	for (let i = 0; i < messages.length; i++) {
		const entry = messages[i];
		const role = entry.message.role;

		// User message starts a new turn (but not toolResult)
		if (role === "user") {
			// Close previous turn if exists
			if (currentTurnStart !== null) {
				boundaries.push({
					startIndex: currentTurnStart,
					endIndex: i - 1,
					turnIndex: turnIndex++,
					hasToolCalls: hasToolCallsInTurn,
				});
			}
			currentTurnStart = i;
			hasToolCallsInTurn = false;
		}

		// Check for tool calls in this message
		if (messageHasToolCalls(entry)) {
			hasToolCallsInTurn = true;
		}
	}

	// Close final turn
	if (currentTurnStart !== null) {
		boundaries.push({
			startIndex: currentTurnStart,
			endIndex: messages.length - 1,
			turnIndex,
			hasToolCalls: hasToolCallsInTurn,
		});
	}

	return boundaries;
}

/**
 * Check if a message entry contains tool calls.
 */
export function messageHasToolCalls(message: MessageEntry): boolean {
	const content = message.message.content;
	if (typeof content === "string") return false;
	return content.some((block) => block.type === "toolCall");
}

/**
 * Get all tool call IDs from a message entry.
 */
export function getToolCallIds(message: MessageEntry): string[] {
	const content = message.message.content;
	if (typeof content === "string") return [];
	return content
		.filter((block): block is ToolCallBlock => block.type === "toolCall")
		.map((block) => block.id);
}
