# Prompt 1.1: Core Algorithm — Skeleton + Red

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Tool stripping based on turn-based presets. Default keeps 20 turns-with-tools, truncates oldest 50%.

**Story 1:** Core algorithm — turn boundary detection and tool call removal. Pure functions, no I/O.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Story 0 complete
- Types exist at `src/types/`
- Fixtures exist at `tests/fixtures/sessions.ts`

## Reference Documents

- Tech Design: `docs/tech-design.md` (Flow 6: Tool Call Stripping)
- Feature Spec: `docs/feature-spec.md` (AC-5.1 through AC-5.8)

## Task

Create skeleton implementations (stubs that throw) and tests that fail against those stubs.

### 1. Create Turn Boundary Calculator Skeleton

Create `src/core/turn-boundary-calculator.ts`:

```typescript
import type { MessageEntry, TurnBoundary } from "../types/index.js";
import { NotImplementedError } from "../errors.js";

/**
 * Identify turn boundaries in session entries.
 *
 * A turn starts when a user sends text content (not a tool result)
 * and ends at the final assistant message before the next user turn.
 *
 * @param messages Session message entries (excluding header)
 * @returns Array of turn boundaries
 */
export function identifyTurnBoundaries(messages: MessageEntry[]): TurnBoundary[] {
  throw new NotImplementedError("identifyTurnBoundaries");
}

/**
 * Check if a message entry contains tool calls.
 */
export function messageHasToolCalls(message: MessageEntry): boolean {
  throw new NotImplementedError("messageHasToolCalls");
}

/**
 * Get all tool call IDs from a message entry.
 */
export function getToolCallIds(message: MessageEntry): string[] {
  throw new NotImplementedError("getToolCallIds");
}
```

### 2. Create Tool Call Remover Skeleton

Create `src/core/tool-call-remover.ts`:

```typescript
import type {
  SessionEntry,
  MessageEntry,
  ResolvedToolRemovalOptions,
  ToolRemovalResult,
  TurnBoundary,
} from "../types/index.js";
import { NotImplementedError } from "../errors.js";

/**
 * Remove/truncate tool calls from session entries based on preset rules.
 *
 * Algorithm:
 * 1. Identify turn boundaries
 * 2. Find turns with tool calls
 * 3. Classify: preserve (newest), truncate (middle), remove (oldest)
 * 4. Process entries accordingly
 * 5. Remove orphaned tool results
 *
 * @param entries Session entries (header + messages)
 * @param options Resolved tool removal options
 * @returns Processed entries and statistics
 */
export function removeToolCalls(
  entries: SessionEntry[],
  options: ResolvedToolRemovalOptions
): ToolRemovalResult {
  throw new NotImplementedError("removeToolCalls");
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
  options: ResolvedToolRemovalOptions
): {
  preserve: number[];
  truncate: number[];
  remove: number[];
} {
  throw new NotImplementedError("classifyTurns");
}

/**
 * Remove tool calls from a message entry entirely.
 * Returns the message with tool call blocks removed.
 */
export function removeToolCallsFromMessage(message: MessageEntry): MessageEntry {
  throw new NotImplementedError("removeToolCallsFromMessage");
}

/**
 * Truncate tool calls in a message entry.
 * Returns the message with tool call arguments truncated and count of truncations.
 */
export function truncateToolCallsInMessage(message: MessageEntry): {
  message: MessageEntry;
  truncatedCount: number;
} {
  throw new NotImplementedError("truncateToolCallsInMessage");
}
```

### 3. Create Session Parser Skeleton

Create `src/core/session-parser.ts`:

```typescript
import type { SessionEntry, SessionHeader, MessageEntry, ParsedSession } from "../types/index.js";
import { NotImplementedError } from "../errors.js";

/**
 * Parse a JSONL string into session entries.
 *
 * @param jsonl Raw JSONL content
 * @returns Array of session entries
 */
export function parseJsonl(jsonl: string): SessionEntry[] {
  throw new NotImplementedError("parseJsonl");
}

/**
 * Serialize session entries to JSONL string.
 *
 * @param entries Session entries
 * @returns JSONL string
 */
export function serializeToJsonl(entries: SessionEntry[]): string {
  throw new NotImplementedError("serializeToJsonl");
}

/**
 * Separate session header from message entries.
 *
 * @param entries All session entries
 * @returns Parsed session with header and messages separated
 */
export function separateHeaderAndMessages(
  entries: SessionEntry[],
  filePath: string
): ParsedSession {
  throw new NotImplementedError("separateHeaderAndMessages");
}

/**
 * Check if an entry is a session header.
 */
export function isSessionHeader(entry: SessionEntry): entry is SessionHeader {
  return entry.type === "session";
}

/**
 * Check if an entry is a message entry.
 */
export function isMessageEntry(entry: SessionEntry): entry is MessageEntry {
  return entry.type === "message";
}
```

### 4. Create Algorithm Tests

Create `tests/algorithms/tool-call-remover.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { removeToolCalls, classifyTurns } from "../../src/core/tool-call-remover.js";
import { identifyTurnBoundaries } from "../../src/core/turn-boundary-calculator.js";
import { createSessionWithTurns } from "../fixtures/sessions.js";
import type { ResolvedToolRemovalOptions, MessageEntry, SessionEntry } from "../../src/types/index.js";

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
    expect(result.statistics.turnsWithToolsPreserved + result.statistics.turnsWithToolsTruncated).toBe(20);
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
    expect(result.statistics.turnsWithToolsPreserved + result.statistics.turnsWithToolsTruncated).toBe(10);
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
    const messages = entries.filter((e): e is MessageEntry => e.type === "message");

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
              originalToolCalls.set(block.id, JSON.parse(JSON.stringify(block.arguments)));
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
    const preservedCallIds = ["call_5_0", "call_6_0", "call_7_0", "call_8_0", "call_9_0"];

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
                file_path: "/very/long/path/" + "x".repeat(200),
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

    // Check that truncated tool calls have arguments within limits
    for (const entry of result.processedEntries) {
      if (entry.type !== "message") continue;
      const content = entry.message.content;
      if (typeof content === "string") continue;

      for (const block of content) {
        if (block.type === "toolCall") {
          // Arguments should be stored as truncated string directly
          const argsValue = block.arguments;
          expect(typeof argsValue).toBe("string");
          const argsStr = argsValue as unknown as string;

          // Should be max 120 chars (plus "..." marker)
          expect(argsStr.length).toBeLessThanOrEqual(123); // 120 + "..."

          // Should be max 2 lines
          const lineCount = argsStr.split("\n").length;
          expect(lineCount).toBeLessThanOrEqual(2);

          // Should have "..." marker appended for truncated arguments
          expect(argsStr.endsWith("...")).toBe(true);
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
    const messages = entries.filter((e): e is MessageEntry => e.type === "message");

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
    const messages = entries.filter((e): e is MessageEntry => e.type === "message");

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
```

## Constraints

- Do NOT implement the functions yet—stubs should throw `NotImplementedError`
- Do NOT modify files outside the specified list
- Tests should fail because stubs throw, not because of type errors

## Verification

```bash
npm run typecheck
npm test
```

**Expected:**
- Typecheck passes (no type errors)
- Tests fail with `NotImplementedError` (stubs throwing)

## Done When

- [ ] `src/core/turn-boundary-calculator.ts` created with stubs
- [ ] `src/core/tool-call-remover.ts` created with stubs
- [ ] `src/core/session-parser.ts` created with stubs
- [ ] `tests/algorithms/tool-call-remover.test.ts` created with 11 tests
- [ ] `npm run typecheck` passes
- [ ] `npm test` runs (tests fail with NotImplementedError)
