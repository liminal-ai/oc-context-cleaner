import type { ToolRemovalOptions } from "./tool-removal-types.js";

/**
 * Options for edit operation.
 */
export interface EditOptions {
	/** Session ID or path (if undefined, auto-detect current) */
	sessionId?: string;
	/** Agent ID (default: from config or "main") */
	agentId?: string;
	/** Tool removal configuration */
	toolRemoval?: ToolRemovalOptions;
	/** Output format */
	outputFormat: "human" | "json";
	/** Verbose output */
	verbose: boolean;
}

/**
 * Statistics for edit operations.
 */
export interface EditStatistics {
	messagesOriginal: number;
	messagesAfter: number;
	toolCallsOriginal: number;
	toolCallsRemoved: number;
	toolCallsTruncated: number;
	toolCallsPreserved: number;
	sizeOriginal: number;
	sizeAfter: number;
	reductionPercent: number;
}

/**
 * Result of edit operation.
 */
export interface EditResult {
	success: boolean;
	mode: "edit";
	sessionId: string;
	backupPath: string;
	statistics: EditStatistics;
}

/**
 * Options for clone operation.
 */
export interface CloneOptions {
	/** Source session ID */
	sourceSessionId: string;
	/** Agent ID (default: from config or "main") */
	agentId?: string;
	/** Output path (if undefined, auto-generate in sessions dir) */
	outputPath?: string;
	/** Tool removal configuration (if undefined, no stripping) */
	toolRemoval?: ToolRemovalOptions;
	/** Skip session index registration */
	noRegister: boolean;
	/** Output format */
	outputFormat: "human" | "json";
	/** Verbose output */
	verbose: boolean;
}

/**
 * Statistics for clone operations.
 */
export interface CloneStatistics {
	messagesOriginal: number;
	messagesCloned: number;
	toolCallsOriginal: number;
	toolCallsRemoved: number;
	toolCallsTruncated: number;
	toolCallsPreserved: number;
	sizeOriginal: number;
	sizeCloned: number;
	reductionPercent: number;
}

/**
 * Result of clone operation.
 */
export interface CloneResult {
	success: boolean;
	mode: "clone";
	sourceSessionId: string;
	clonedSessionId: string;
	clonedSessionPath: string;
	statistics: CloneStatistics;
	resumeCommand?: string;
}

/**
 * Options for list operation.
 */
export interface ListOptions {
	/** Agent ID (default: from config or "main") */
	agentId?: string;
	/** Limit number of results */
	limit?: number;
	/** Output format */
	outputFormat: "human" | "json";
}

/**
 * Options for info operation.
 */
export interface InfoOptions {
	/** Session ID */
	sessionId: string;
	/** Agent ID (default: from config or "main") */
	agentId?: string;
	/** Output format */
	outputFormat: "human" | "json";
}

/**
 * Session info statistics.
 */
export interface SessionInfo {
	sessionId: string;
	totalMessages: number;
	userMessages: number;
	assistantMessages: number;
	toolCalls: number;
	toolResults: number;
	estimatedTokens: number;
	fileSizeBytes: number;
}

/**
 * Options for restore operation.
 */
export interface RestoreOptions {
	/** Session ID */
	sessionId: string;
	/** Agent ID (default: from config or "main") */
	agentId?: string;
}
