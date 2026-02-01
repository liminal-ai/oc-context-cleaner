/**
 * OpenClaw session types.
 *
 * OpenClaw uses a different format than Claude Code:
 * - Tool calls: `{type: "toolCall"}` not `tool_use`
 * - Tool results: `{role: "toolResult"}` not content block
 * - Linear transcript (no parent/child UUID tree)
 * - Session header: separate `{type: "session"}` entry
 */

/**
 * OpenClaw session header entry (first line of JSONL).
 */
export interface SessionHeader {
	type: "session";
	version: string;
	id: string;
	timestamp: string;
	cwd: string;
}

/**
 * Extended session header for cloned sessions.
 * Includes metadata about the clone operation.
 */
export interface ClonedSessionHeader extends SessionHeader {
	clonedFrom?: string;
	clonedAt?: string;
}

/**
 * Content block within a message.
 */
export type ContentBlock = TextBlock | ToolCallBlock | ThinkingBlock;

export interface TextBlock {
	type: "text";
	text: string;
}

/**
 * Thinking block (extended thinking from Claude).
 * Removed when stripping tools to reduce context size.
 */
export interface ThinkingBlock {
	type: "thinking";
	thinking: string;
	signature?: string;
}

/**
 * Tool call block in assistant message content.
 * Note: "toolCall" not "tool_use" (differs from Claude Code).
 */
export interface ToolCallBlock {
	type: "toolCall";
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

/**
 * Message roles in OpenClaw.
 * Note: "toolResult" is a role, not a content block type.
 */
export type MessageRole = "user" | "assistant" | "toolResult";

/**
 * Usage information for assistant messages.
 */
export interface UsageInfo {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
}

/**
 * Conversation message structure.
 */
export interface ConversationMessage {
	role: MessageRole;
	content: ContentBlock[] | string;

	// Optional metadata (present on assistant messages)
	api?: string;
	provider?: string;
	model?: string;
	stopReason?: string;
	usage?: UsageInfo;

	// Present on toolResult messages
	toolCallId?: string;
}

/**
 * Message entry in session JSONL (non-header lines).
 */
export interface MessageEntry {
	type: "message";
	timestamp: number;
	message: ConversationMessage;
}

/**
 * Union type for all JSONL line items.
 */
export type SessionEntry = SessionHeader | MessageEntry;

/**
 * Parsed session with header separated from messages.
 */
export interface ParsedSession {
	header: SessionHeader;
	messages: MessageEntry[];
	filePath: string;
}

/**
 * Session index entry from sessions.json.
 */
export interface SessionIndexEntry {
	sessionId: string;
	updatedAt: number;
	sessionFile?: string;
	displayName?: string;
	label?: string;
	projectPath?: string;
	cwd?: string;
}

/**
 * Sessions index structure (JSON object, not array).
 */
export interface SessionsIndex {
	[sessionKey: string]: SessionIndexEntry;
}
