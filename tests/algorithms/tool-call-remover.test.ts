import { describe, expect, it } from "vitest";
import {
	classifyTurns,
	removeToolCalls,
} from "../../src/core/tool-call-remover.js";
import { identifyTurnBoundaries } from "../../src/core/turn-boundary-calculator.js";
import type {
	MessageEntry,
	ResolvedToolRemovalOptions,
} from "../../src/types/index.js";
import {
	createSessionWithThinking,
	createSessionWithTurns,
} from "../fixtures/sessions.js";

describe("tool-call-remover", () => {
	// TC-5.1a: Default keeps 20 turns with tools
	it("default preset keeps last 20 turns with tools", () => {
		const entries = createSessionWithTurns(30, 1); // 30 turns, each with 1 tool call
		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 20,
			truncatePercent: 50,
		};

		const result = removeToolCalls(entries, options);

		// Should have removed first 10 turns' tool calls
		expect(result.statistics.turnsWithToolsRemoved).toBe(10);
		expect(
			result.statistics.turnsWithToolsPreserved +
				result.statistics.turnsWithToolsTruncated,
		).toBe(20);
	});

	// TC-5.1b: Default truncates oldest 50% of kept turns
	it("default preset truncates oldest 50% of kept turns", () => {
		const entries = createSessionWithTurns(30, 1);
		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 20,
			truncatePercent: 50,
		};

		const result = removeToolCalls(entries, options);

		// Of the 20 kept, 10 should be truncated (oldest 50%)
		expect(result.statistics.turnsWithToolsTruncated).toBe(10);
		// And 10 should be preserved at full fidelity (newest 50%)
		expect(result.statistics.turnsWithToolsPreserved).toBe(10);
	});

	// TC-5.2a: Aggressive keeps 10 turns with tools
	it("aggressive preset keeps last 10 turns with tools", () => {
		const entries = createSessionWithTurns(20, 1);
		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 10,
			truncatePercent: 50,
		};

		const result = removeToolCalls(entries, options);

		expect(result.statistics.turnsWithToolsRemoved).toBe(10);
		expect(
			result.statistics.turnsWithToolsPreserved +
				result.statistics.turnsWithToolsTruncated,
		).toBe(10);
		// Of the 10 kept, 5 truncated, 5 preserved
		expect(result.statistics.turnsWithToolsTruncated).toBe(5);
		expect(result.statistics.turnsWithToolsPreserved).toBe(5);
	});

	// TC-5.3a: Extreme removes all tool calls
	it("extreme preset removes all tool calls", () => {
		const entries = createSessionWithTurns(10, 1);
		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 0,
			truncatePercent: 0,
		};

		const result = removeToolCalls(entries, options);

		expect(result.statistics.turnsWithToolsRemoved).toBe(10);
		expect(result.statistics.turnsWithToolsPreserved).toBe(0);
		expect(result.statistics.turnsWithToolsTruncated).toBe(0);

		// Verify no tool calls remain in output
		const hasToolCalls = result.processedEntries.some((entry) => {
			if (entry.type !== "message") return false;
			const content = entry.message.content;
			if (typeof content === "string") return false;
			return content.some((block) => block.type === "toolCall");
		});
		expect(hasToolCalls).toBe(false);
	});

	// TC-5.4a: No dangling tool references
	it("leaves no dangling tool references after removal", () => {
		const entries = createSessionWithTurns(15, 1);
		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 5,
			truncatePercent: 0,
		};

		const result = removeToolCalls(entries, options);

		// Collect all tool call IDs and tool result references
		const toolCallIds = new Set<string>();
		const toolResultRefs = new Set<string>();

		for (const entry of result.processedEntries) {
			if (entry.type !== "message") continue;
			const content = entry.message.content;

			if (entry.message.role === "toolResult" && entry.message.toolCallId) {
				toolResultRefs.add(entry.message.toolCallId);
			}

			if (typeof content !== "string") {
				for (const block of content) {
					if (block.type === "toolCall") {
						toolCallIds.add(block.id);
					}
				}
			}
		}

		// Every tool result should reference an existing tool call
		for (const ref of toolResultRefs) {
			expect(toolCallIds.has(ref)).toBe(true);
		}
	});

	// TC-5.5a: Preserved turns have unmodified tool calls
	it("preserved turns have completely unmodified tool calls", () => {
		const entries = createSessionWithTurns(10, 1);

		// Store original tool call content for preserved turns (newest 5)
		const originalToolCalls = new Map<string, Record<string, unknown>>();
		// Filter messages (unused but kept for documentation purposes)
		const _messages = entries.filter(
			(e): e is MessageEntry => e.type === "message",
		);

		// With 10 turns, keepTurnsWithTools=10, truncatePercent=50:
		// - 5 truncated (oldest)
		// - 5 preserved (newest)
		// The preserved turns are the last 5 turns (indices 5-9)
		for (const entry of entries) {
			if (entry.type === "message") {
				const content = entry.message.content;
				if (typeof content !== "string") {
					for (const block of content) {
						if (block.type === "toolCall") {
							// Store original for later comparison
							originalToolCalls.set(
								block.id,
								JSON.parse(JSON.stringify(block.arguments)),
							);
						}
					}
				}
			}
		}

		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 10,
			truncatePercent: 50, // Truncate oldest 5, preserve newest 5
		};

		const result = removeToolCalls(entries, options);

		// Collect preserved tool calls (from newest 5 turns: call_5_0 through call_9_0)
		const preservedCallIds = [
			"call_5_0",
			"call_6_0",
			"call_7_0",
			"call_8_0",
			"call_9_0",
		];

		for (const entry of result.processedEntries) {
			if (entry.type !== "message") continue;
			const content = entry.message.content;
			if (typeof content === "string") continue;

			for (const block of content) {
				if (block.type === "toolCall" && preservedCallIds.includes(block.id)) {
					// Preserved tool calls must be identical to original
					expect(block.arguments).toEqual(originalToolCalls.get(block.id));
				}
			}
		}
	});

	// TC-5.6a: Truncation respects limits
	it("truncation respects 120 char / 2 line limits with markers", () => {
		// Create a session with a very long tool call argument
		const entries = createSessionWithTurns(5, 1);

		// Modify a tool call to have very long arguments
		for (const entry of entries) {
			if (entry.type === "message") {
				const content = entry.message.content;
				if (typeof content !== "string") {
					for (const block of content) {
						if (block.type === "toolCall") {
							block.arguments = {
								file_path: `/very/long/path/${"x".repeat(200)}`,
								extra: "line1\nline2\nline3\nline4\nline5",
							};
						}
					}
				}
			}
		}

		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 5,
			truncatePercent: 100, // Truncate all kept turns
		};

		const result = removeToolCalls(entries, options);

		// Check that truncated tool calls have arguments as object with _truncated marker
		for (const entry of result.processedEntries) {
			if (entry.type !== "message") continue;
			const content = entry.message.content;
			if (typeof content === "string") continue;

			for (const block of content) {
				if (block.type === "toolCall") {
					// Arguments should be stored as object with _truncated marker
					const argsValue = block.arguments as {
						_truncated: boolean;
						preview: string;
					};
					expect(typeof argsValue).toBe("object");
					expect(argsValue._truncated).toBe(true);
					expect(typeof argsValue.preview).toBe("string");

					const preview = argsValue.preview;
					// Should be max 120 chars (plus "..." marker)
					expect(preview.length).toBeLessThanOrEqual(123); // 120 + "..."

					// Should be max 2 lines
					const lineCount = preview.split("\n").length;
					expect(lineCount).toBeLessThanOrEqual(2);

					// Should have "..." marker appended for truncated arguments
					expect(preview.endsWith("...")).toBe(true);
				}
			}
		}

		// Verify tool result truncation uses "[truncated]" marker
		for (const entry of result.processedEntries) {
			if (entry.type !== "message") continue;
			if (entry.message.role !== "toolResult") continue;

			const content = entry.message.content;
			// Tool results with long content should be truncated with "[truncated]"
			if (typeof content === "string" && content.length > 0) {
				// If content was truncated, it should end with [truncated]
				// Note: short content won't be truncated
				const lineCount = content.split("\n").length;
				if (lineCount > 2 || content.length > 120) {
					expect(content.endsWith("[truncated]")).toBe(true);
				}
			}
		}
	});

	// TC-5.7a: Removed tool calls deleted entirely
	it("removed tool calls are deleted entirely", () => {
		const entries = createSessionWithTurns(10, 1);
		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 5,
			truncatePercent: 0,
		};

		const result = removeToolCalls(entries, options);

		// Count tool calls in output
		let toolCallCount = 0;
		let toolResultCount = 0;

		for (const entry of result.processedEntries) {
			if (entry.type !== "message") continue;
			const content = entry.message.content;

			if (entry.message.role === "toolResult") {
				toolResultCount++;
			}

			if (typeof content !== "string") {
				for (const block of content) {
					if (block.type === "toolCall") {
						toolCallCount++;
					}
				}
			}
		}

		// Should have exactly 5 tool calls (from 5 kept turns)
		expect(toolCallCount).toBe(5);
		// And 5 corresponding tool results
		expect(toolResultCount).toBe(5);
	});

	// TC-5.8a: No-tool session unchanged
	it("session without tools processes unchanged", () => {
		const entries = createSessionWithTurns(5, 0); // No tools
		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 20,
			truncatePercent: 50,
		};

		const result = removeToolCalls(entries, options);

		// All messages should be preserved
		expect(result.processedEntries.length).toBe(entries.length);
		expect(result.statistics.turnsWithToolsTotal).toBe(0);
		expect(result.statistics.toolCallsRemoved).toBe(0);
	});
});

describe("turn-boundary-calculator", () => {
	it("identifies turn boundaries correctly", () => {
		const entries = createSessionWithTurns(3, 1);
		// Filter to just message entries (skip header)
		const messages = entries.filter(
			(e): e is MessageEntry => e.type === "message",
		);

		const boundaries = identifyTurnBoundaries(messages);

		expect(boundaries.length).toBe(3);
		expect(boundaries[0].turnIndex).toBe(0);
		expect(boundaries[1].turnIndex).toBe(1);
		expect(boundaries[2].turnIndex).toBe(2);
		// All turns have tools
		expect(boundaries.every((b) => b.hasToolCalls)).toBe(true);
	});

	it("marks turns without tools correctly", () => {
		const entries = createSessionWithTurns(3, 0); // No tools
		const messages = entries.filter(
			(e): e is MessageEntry => e.type === "message",
		);

		const boundaries = identifyTurnBoundaries(messages);

		expect(boundaries.length).toBe(3);
		expect(boundaries.every((b) => !b.hasToolCalls)).toBe(true);
	});
});

describe("classifyTurns", () => {
	it("classifies turns into preserve/truncate/remove", () => {
		// Create mock turn boundaries
		const turnsWithTools = Array.from({ length: 10 }, (_, i) => ({
			startIndex: i * 4,
			endIndex: i * 4 + 3,
			turnIndex: i,
			hasToolCalls: true,
		}));

		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 6,
			truncatePercent: 50,
		};

		const classified = classifyTurns(turnsWithTools, options);

		// 4 removed (oldest)
		expect(classified.remove.length).toBe(4);
		// 3 truncated (oldest 50% of kept 6)
		expect(classified.truncate.length).toBe(3);
		// 3 preserved (newest 50% of kept 6)
		expect(classified.preserve.length).toBe(3);

		// Removed should be turns 0-3 (oldest)
		expect(classified.remove).toEqual([0, 1, 2, 3]);
		// Truncated should be turns 4-6
		expect(classified.truncate).toEqual([4, 5, 6]);
		// Preserved should be turns 7-9 (newest)
		expect(classified.preserve).toEqual([7, 8, 9]);
	});
});

describe("thinking-block-removal", () => {
	it("removes all thinking blocks when tool stripping is active", () => {
		const entries = createSessionWithThinking(5, 1, true);

		// Count thinking blocks before
		let thinkingBefore = 0;
		for (const entry of entries) {
			if (entry.type === "message") {
				const content = entry.message.content;
				if (typeof content !== "string") {
					for (const block of content) {
						if (block.type === "thinking") {
							thinkingBefore++;
						}
					}
				}
			}
		}
		expect(thinkingBefore).toBeGreaterThan(0);

		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 5,
			truncatePercent: 50,
		};

		const result = removeToolCalls(entries, options);

		// Count thinking blocks after
		let thinkingAfter = 0;
		for (const entry of result.processedEntries) {
			if (entry.type === "message") {
				const content = entry.message.content;
				if (typeof content !== "string") {
					for (const block of content) {
						if (block.type === "thinking") {
							thinkingAfter++;
						}
					}
				}
			}
		}

		expect(thinkingAfter).toBe(0);
		expect(result.statistics.thinkingBlocksRemoved).toBe(thinkingBefore);
	});

	it("removes thinking blocks even when no tools present", () => {
		// Create session with thinking blocks but no tools
		// When --strip-tools is used, thinking blocks are always removed
		// to maximize context reduction, regardless of tool presence
		const entries = createSessionWithThinking(3, 0, true);

		// Count thinking blocks before
		let thinkingBefore = 0;
		for (const entry of entries) {
			if (entry.type === "message") {
				const content = entry.message.content;
				if (typeof content !== "string") {
					for (const block of content) {
						if (block.type === "thinking") {
							thinkingBefore++;
						}
					}
				}
			}
		}
		expect(thinkingBefore).toBeGreaterThan(0);

		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 10,
			truncatePercent: 50,
		};

		const result = removeToolCalls(entries, options);

		// Count thinking blocks after
		let thinkingAfter = 0;
		for (const entry of result.processedEntries) {
			if (entry.type === "message") {
				const content = entry.message.content;
				if (typeof content !== "string") {
					for (const block of content) {
						if (block.type === "thinking") {
							thinkingAfter++;
						}
					}
				}
			}
		}

		// Thinking blocks should be removed even when no tools present
		expect(thinkingAfter).toBe(0);
		expect(result.statistics.thinkingBlocksRemoved).toBe(thinkingBefore);
	});

	it("reports thinkingBlocksRemoved in statistics", () => {
		const entries = createSessionWithThinking(3, 1, true);

		const options: ResolvedToolRemovalOptions = {
			keepTurnsWithTools: 3,
			truncatePercent: 0,
		};

		const result = removeToolCalls(entries, options);

		// 3 turns * 2 thinking blocks per turn (one in tool call msg, one in response)
		expect(result.statistics.thinkingBlocksRemoved).toBe(6);
	});
});
