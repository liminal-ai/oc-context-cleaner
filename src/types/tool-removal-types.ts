import type { ContentBlock, SessionEntry } from "./session-types.js";

/**
 * A turn represents one user input through the final assistant response.
 */
export interface TurnBoundary {
	startIndex: number;
	endIndex: number;
	turnIndex: number;
	hasToolCalls: boolean;
}

/**
 * Tool removal preset definition.
 */
export interface ToolRemovalPreset {
	name: string;
	/** How many turns-with-tools to keep (newest first) */
	keepTurnsWithTools: number;
	/** Percentage of kept turns to truncate (oldest portion, 0-100) */
	truncatePercent: number;
}

/**
 * Options for tool removal (may use preset name or override values).
 */
export interface ToolRemovalOptions {
	preset?: string;
	keepTurnsWithTools?: number;
	truncatePercent?: number;
	/** Custom presets from config */
	customPresets?: Record<string, ToolRemovalPreset>;
}

/**
 * Resolved tool removal options (all values concrete).
 */
export interface ResolvedToolRemovalOptions {
	keepTurnsWithTools: number;
	truncatePercent: number;
}

/**
 * Statistics from tool removal.
 */
export interface ToolRemovalStatistics {
	turnsWithToolsTotal: number;
	turnsWithToolsRemoved: number;
	turnsWithToolsTruncated: number;
	turnsWithToolsPreserved: number;
	toolCallsRemoved: number;
	toolCallsTruncated: number;
	thinkingBlocksRemoved: number;
}

/**
 * Result of tool removal operation.
 */
export interface ToolRemovalResult {
	processedEntries: SessionEntry[];
	statistics: ToolRemovalStatistics;
}

/**
 * Truncation constants.
 */
export const TRUNCATION_LIMITS = {
	maxChars: 120,
	maxLines: 2,
	argumentMarker: "...",
	contentMarker: "[truncated]",
} as const;

/**
 * Truncate a string to the specified limits.
 * Returns the truncated string without any marker appended.
 */
export function truncateString(
	str: string,
	maxChars: number,
	maxLines: number,
): string {
	// First limit by lines
	const lines = str.split("\n");
	let result = lines.slice(0, maxLines).join("\n");

	// Then limit by characters
	if (result.length > maxChars) {
		result = result.slice(0, maxChars);
	}

	return result;
}

/**
 * Truncate tool call arguments for display.
 * Returns JSON-stringified args truncated to limits with "..." marker if truncated.
 */
export function truncateArguments(args: Record<string, unknown>): string {
	const { maxChars, maxLines, argumentMarker } = TRUNCATION_LIMITS;
	const json = JSON.stringify(args);

	// Check if truncation is needed
	const lines = json.split("\n");
	const needsLineTruncation = lines.length > maxLines;
	const needsCharTruncation = json.length > maxChars;

	if (!needsLineTruncation && !needsCharTruncation) {
		return json;
	}

	const truncated = truncateString(json, maxChars, maxLines);
	return truncated + argumentMarker;
}

/**
 * Truncate tool result content for display.
 * Returns content truncated to limits with "[truncated]" marker if truncated.
 */
export function truncateToolResult(content: string | ContentBlock[]): string {
	const { maxChars, maxLines, contentMarker } = TRUNCATION_LIMITS;

	// Convert content blocks to string
	let str: string;
	if (typeof content === "string") {
		str = content;
	} else {
		str = content
			.filter(
				(block): block is { type: "text"; text: string } =>
					block.type === "text",
			)
			.map((block) => block.text)
			.join("\n");
	}

	// Check if truncation is needed
	const lines = str.split("\n");
	const needsLineTruncation = lines.length > maxLines;
	const needsCharTruncation = str.length > maxChars;

	if (!needsLineTruncation && !needsCharTruncation) {
		return str;
	}

	const truncated = truncateString(str, maxChars, maxLines);
	return truncated + contentMarker;
}
