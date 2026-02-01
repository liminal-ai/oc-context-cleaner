// Session types
export type {
	SessionHeader,
	ClonedSessionHeader,
	ContentBlock,
	TextBlock,
	ToolCallBlock,
	ThinkingBlock,
	MessageRole,
	UsageInfo,
	ConversationMessage,
	MessageEntry,
	SessionEntry,
	ParsedSession,
	SessionIndexEntry,
	SessionsIndex,
} from "./session-types.js";

// Operation types
export type {
	EditOptions,
	EditStatistics,
	EditResult,
	CloneOptions,
	CloneStatistics,
	CloneResult,
	ListOptions,
	InfoOptions,
	SessionInfo,
	RestoreOptions,
} from "./operation-types.js";

// Tool removal types
export type {
	TurnBoundary,
	ToolRemovalPreset,
	ToolRemovalOptions,
	ResolvedToolRemovalOptions,
	ToolRemovalStatistics,
	ToolRemovalResult,
} from "./tool-removal-types.js";

export {
	TRUNCATION_LIMITS,
	truncateString,
	truncateArguments,
	truncateToolResult,
} from "./tool-removal-types.js";

// Configuration types
export type {
	UserConfiguration,
	ResolvedConfiguration,
} from "./configuration-types.js";
