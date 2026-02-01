# Prompt 1.2: Core Algorithm — Green

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Tool stripping based on turn-based presets.

**Story 1:** Core algorithm implementation. Make all tests pass.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Story 1 Skeleton+Red complete
- Tests exist and fail with `NotImplementedError`
- 11 tests to make pass

## Reference Documents

- Tech Design: `docs/tech-design.md` (Flow 6: Tool Call Stripping, Low Altitude interfaces)
- Feature Spec: `docs/feature-spec.md` (AC-5.1 through AC-5.8)

## Task

Implement the core algorithm to make all tests pass.

### 1. Implement Turn Boundary Calculator

Replace stubs in `src/core/turn-boundary-calculator.ts`:

```typescript
import type { MessageEntry, TurnBoundary, ToolCallBlock } from "../types/index.js";

/**
 * Identify turn boundaries in session entries.
 *
 * A turn starts when a user sends text content (not a tool result)
 * and ends at the final assistant message before the next user turn.
 */
export function identifyTurnBoundaries(messages: MessageEntry[]): TurnBoundary[] {
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
```

### 2. Implement Tool Call Remover

Replace stubs in `src/core/tool-call-remover.ts`:

```typescript
import type {
  SessionEntry,
  MessageEntry,
  ResolvedToolRemovalOptions,
  ToolRemovalResult,
  ToolRemovalStatistics,
  TurnBoundary,
  ContentBlock,
  ToolCallBlock,
} from "../types/index.js";
import { truncateArguments, truncateToolResult } from "../types/index.js";
import { identifyTurnBoundaries, getToolCallIds } from "./turn-boundary-calculator.js";
import { isSessionHeader, isMessageEntry } from "./session-parser.js";

/**
 * Remove/truncate tool calls from session entries based on preset rules.
 */
export function removeToolCalls(
  entries: SessionEntry[],
  options: ResolvedToolRemovalOptions
): ToolRemovalResult {
  // Separate header and messages
  const header = entries.find(isSessionHeader);
  const messages = entries.filter(isMessageEntry);

  // Identify turn boundaries
  const allTurns = identifyTurnBoundaries(messages);
  const turnsWithTools = allTurns.filter((t) => t.hasToolCalls);

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
        const { message: truncated, truncatedCount } = truncateToolCallsInMessage(message);
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

  // Remove any orphaned tool results (shouldn't happen with correct algorithm, but safety check)
  const finalMessages = processedMessages.filter((msg) => {
    if (msg.message.role === "toolResult" && msg.message.toolCallId) {
      return keptToolCallIds.has(msg.message.toolCallId);
    }
    return true;
  });

  // Build result entries
  const processedEntries: SessionEntry[] = header ? [header, ...finalMessages] : finalMessages;

  // Calculate statistics
  const statistics = calculateStatistics(
    turnsWithTools,
    classified,
    messages,
    finalMessages,
    toolCallsTruncatedCount
  );

  return { processedEntries, statistics };
}

/**
 * Classify turns into preserve, truncate, or remove categories.
 */
export function classifyTurns(
  turnsWithTools: TurnBoundary[],
  options: ResolvedToolRemovalOptions
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
  const preserveCount = keepCount - truncateCount;

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
 */
export function removeToolCallsFromMessage(message: MessageEntry): MessageEntry {
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
 * Returns the count of tool calls that were truncated.
 */
export function truncateToolCallsInMessage(message: MessageEntry): { message: MessageEntry; truncatedCount: number } {
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
      content: [{ type: "text", text: truncated }],
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
  toolCallsTruncatedCount: number
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
    toolCallsTruncated: toolCallsTruncatedCount, // Count of individual tool calls truncated
  };
}
```

### 3. Implement Session Parser

Replace stubs in `src/core/session-parser.ts`:

```typescript
import type { SessionEntry, SessionHeader, MessageEntry, ParsedSession } from "../types/index.js";

/**
 * Parse a JSONL string into session entries.
 */
export function parseJsonl(jsonl: string): SessionEntry[] {
  const lines = jsonl.split("\n").filter((line) => line.trim());
  return lines.map((line) => JSON.parse(line) as SessionEntry);
}

/**
 * Serialize session entries to JSONL string.
 */
export function serializeToJsonl(entries: SessionEntry[]): string {
  return entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
}

/**
 * Separate session header from message entries.
 */
export function separateHeaderAndMessages(
  entries: SessionEntry[],
  filePath: string
): ParsedSession {
  const header = entries.find(isSessionHeader);
  if (!header) {
    throw new Error("Session file missing header");
  }

  const messages = entries.filter(isMessageEntry);

  return {
    header,
    messages,
    filePath,
  };
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

## Constraints

- Implement ONLY the three core modules
- Do NOT create new files
- Do NOT modify tests (they define the contract)
- Ensure no dangling tool references in output

## Verification

```bash
npm run typecheck
npm test
```

**Expected:**
- Typecheck passes
- All 11 tests pass (0 failures)

## Done When

- [ ] `src/core/turn-boundary-calculator.ts` fully implemented
- [ ] `src/core/tool-call-remover.ts` fully implemented
- [ ] `src/core/session-parser.ts` fully implemented
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (all tests green)
