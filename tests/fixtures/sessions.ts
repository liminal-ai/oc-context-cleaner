import type {
	ContentBlock,
	MessageEntry,
	SessionEntry,
	SessionHeader,
	SessionIndexEntry,
	TextBlock,
	ThinkingBlock,
	ToolCallBlock,
} from "../../src/types/index.js";

export const FIXTURE_SESSION_HEADER: SessionHeader = {
	type: "session",
	version: "0.49.3",
	id: "test-session-001",
	timestamp: "2025-01-31T12:00:00.000Z",
	cwd: "/test/project",
};

export const FIXTURE_USER_MESSAGE: MessageEntry = {
	type: "message",
	timestamp: 1738324800000,
	message: {
		role: "user",
		content: [{ type: "text", text: "Hello" }],
	},
};

export const FIXTURE_ASSISTANT_WITH_TOOL: MessageEntry = {
	type: "message",
	timestamp: 1738324801000,
	message: {
		role: "assistant",
		content: [
			{ type: "text", text: "Let me check that." },
			{
				type: "toolCall",
				id: "call_001",
				name: "Read",
				arguments: { file_path: "/test.txt" },
			},
		],
		stopReason: "toolUse",
	},
};

export const FIXTURE_TOOL_RESULT: MessageEntry = {
	type: "message",
	timestamp: 1738324802000,
	message: {
		role: "toolResult",
		toolCallId: "call_001",
		content: [{ type: "text", text: "File contents here" }],
	},
};

export const FIXTURE_ASSISTANT_RESPONSE: MessageEntry = {
	type: "message",
	timestamp: 1738324803000,
	message: {
		role: "assistant",
		content: [{ type: "text", text: "Here is the file content." }],
		stopReason: "stop",
	},
};

/**
 * Create a session with N turns for testing.
 *
 * Each turn consists of:
 * 1. User message (text)
 * 2. Assistant message with tool calls (if toolsPerTurn > 0)
 * 3. Tool result messages (one per tool call)
 * 4. Final assistant response (text)
 */
export function createSessionWithTurns(
	turnCount: number,
	toolsPerTurn: number = 1,
): SessionEntry[] {
	const entries: SessionEntry[] = [];
	let timestamp = 1738324800000;

	// Header
	entries.push({
		type: "session",
		version: "0.49.3",
		id: `test-session-${Math.random().toString(36).slice(2, 10)}`,
		timestamp: new Date(timestamp).toISOString(),
		cwd: "/test/project",
	});

	for (let turn = 0; turn < turnCount; turn++) {
		// User message
		entries.push({
			type: "message",
			timestamp: timestamp++,
			message: {
				role: "user",
				content: [{ type: "text", text: `User message for turn ${turn}` }],
			},
		});

		if (toolsPerTurn > 0) {
			// Assistant with tool calls
			const toolCalls: ToolCallBlock[] = [];
			for (let t = 0; t < toolsPerTurn; t++) {
				toolCalls.push({
					type: "toolCall",
					id: `call_${turn}_${t}`,
					name: "Read",
					arguments: { file_path: `/test/file_${turn}_${t}.txt` },
				});
			}

			const content: (TextBlock | ToolCallBlock)[] = [
				{ type: "text", text: "Let me check." },
				...toolCalls,
			];

			entries.push({
				type: "message",
				timestamp: timestamp++,
				message: {
					role: "assistant",
					content,
					stopReason: "toolUse",
				},
			});

			// Tool results
			for (let t = 0; t < toolsPerTurn; t++) {
				entries.push({
					type: "message",
					timestamp: timestamp++,
					message: {
						role: "toolResult",
						toolCallId: `call_${turn}_${t}`,
						content: [
							{ type: "text", text: `Result for tool call ${turn}_${t}` },
						],
					},
				});
			}
		}

		// Final assistant response
		entries.push({
			type: "message",
			timestamp: timestamp++,
			message: {
				role: "assistant",
				content: [{ type: "text", text: `Response for turn ${turn}` }],
				stopReason: "stop",
			},
		});
	}

	return entries;
}

/**
 * Create a minimal session index for testing.
 */
export function createSessionIndex(
	sessionIds: string[],
): Record<string, SessionIndexEntry> {
	const index: Record<string, SessionIndexEntry> = {};
	let timestamp = Date.now();

	for (const id of sessionIds) {
		index[id] = {
			sessionId: id,
			updatedAt: timestamp--,
		};
	}

	return index;
}

/**
 * Create a session with thinking blocks for testing.
 *
 * Each turn consists of:
 * 1. User message (text)
 * 2. Assistant message with thinking block, text, and tool calls (if toolsPerTurn > 0)
 * 3. Tool result messages (one per tool call)
 * 4. Final assistant response (text + optional thinking)
 */
export function createSessionWithThinking(
	turnCount: number,
	toolsPerTurn: number = 1,
	includeThinking: boolean = true,
): SessionEntry[] {
	const entries: SessionEntry[] = [];
	let timestamp = 1738324800000;

	// Header
	entries.push({
		type: "session",
		version: "0.49.3",
		id: `test-session-${Math.random().toString(36).slice(2, 10)}`,
		timestamp: new Date(timestamp).toISOString(),
		cwd: "/test/project",
	});

	for (let turn = 0; turn < turnCount; turn++) {
		// User message
		entries.push({
			type: "message",
			timestamp: timestamp++,
			message: {
				role: "user",
				content: [{ type: "text", text: `User message for turn ${turn}` }],
			},
		});

		if (toolsPerTurn > 0) {
			// Assistant with thinking block and tool calls
			const toolCalls: ToolCallBlock[] = [];
			for (let t = 0; t < toolsPerTurn; t++) {
				toolCalls.push({
					type: "toolCall",
					id: `call_${turn}_${t}`,
					name: "Read",
					arguments: { file_path: `/test/file_${turn}_${t}.txt` },
				});
			}

			const content: ContentBlock[] = [];

			if (includeThinking) {
				content.push({
					type: "thinking",
					thinking: `Thinking about turn ${turn}... Let me analyze this carefully.`,
					signature: `sig_${turn}`,
				} as ThinkingBlock);
			}

			content.push({ type: "text", text: "Let me check." });
			content.push(...toolCalls);

			entries.push({
				type: "message",
				timestamp: timestamp++,
				message: {
					role: "assistant",
					content,
					stopReason: "toolUse",
				},
			});

			// Tool results
			for (let t = 0; t < toolsPerTurn; t++) {
				entries.push({
					type: "message",
					timestamp: timestamp++,
					message: {
						role: "toolResult",
						toolCallId: `call_${turn}_${t}`,
						content: [
							{ type: "text", text: `Result for tool call ${turn}_${t}` },
						],
					},
				});
			}
		}

		// Final assistant response (with thinking block)
		const finalContent: ContentBlock[] = [];
		if (includeThinking) {
			finalContent.push({
				type: "thinking",
				thinking: `Final thoughts for turn ${turn}...`,
				signature: `final_sig_${turn}`,
			} as ThinkingBlock);
		}
		finalContent.push({ type: "text", text: `Response for turn ${turn}` });

		entries.push({
			type: "message",
			timestamp: timestamp++,
			message: {
				role: "assistant",
				content: finalContent,
				stopReason: "stop",
			},
		});
	}

	return entries;
}
