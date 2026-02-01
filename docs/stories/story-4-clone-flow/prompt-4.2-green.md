# Prompt 4.2: Clone Flow — Green

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Clone command implementation.

**Story 4:** Implement clone flow to pass all 11 tests.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Story 4 Skeleton+Red complete
- 31 previous tests pass
- 11 clone tests ERROR with NotImplementedError

## Reference Documents

- Tech Design: `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner/docs/tech-design.md` (Flow 2)
- Tests: `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner/tests/commands/clone-command.test.ts`

## Task

Implement clone modules to make all tests pass.

### 1. Implement Clone Operation Executor

Replace stubs in `src/core/clone-operation-executor.ts`:

```typescript
import { randomUUID } from "node:crypto";
import type {
  CloneOptions,
  CloneResult,
  CloneStatistics,
  SessionEntry,
  SessionHeader,
} from "../types/index.js";
import { resolveSessionId } from "../io/session-discovery.js";
import { readSessionEntries, getSessionFileStats } from "../io/session-file-reader.js";
import { writeSessionFile } from "../io/session-file-writer.js";
import { addSessionToIndex } from "../io/session-index-writer.js";
import { getSessionPath, getSessionsDirectory, resolveAgentId } from "../io/paths.js";
import { removeToolCalls } from "./tool-call-remover.js";
import { resolveToolRemovalOptions } from "../config/tool-removal-presets.js";
import { CloneOperationError } from "../errors.js";
import { isSessionHeader, isMessageEntry } from "./session-parser.js";
import { getToolCallIds } from "./turn-boundary-calculator.js";
import { join } from "node:path";

/**
 * Execute clone operation on a session.
 */
export async function executeClone(options: CloneOptions): Promise<CloneResult> {
  const agentId = resolveAgentId(options.agentId);

  // Resolve source session ID (may be partial)
  const sourceSessionId = await resolveSessionId(options.sourceSessionId, agentId);
  const sourcePath = getSessionPath(sourceSessionId, agentId);

  try {
    // Get original stats
    const originalStats = await getSessionFileStats(sourcePath);

    // Read source session
    const entries = await readSessionEntries(sourcePath);

    // Count original tool calls and messages
    const originalToolCalls = countToolCalls(entries);
    const originalMessages = entries.filter(isMessageEntry).length;

    // Apply tool removal if specified
    let processedEntries = entries;
    let toolStats = {
      original: originalToolCalls,
      removed: 0,
      truncated: 0,
      preserved: originalToolCalls,
    };

    // AC-5.x: Apply tool removal if specified
    if (options.toolRemoval) {
      const resolvedOptions = resolveToolRemovalOptions(options.toolRemoval);
      const result = removeToolCalls(entries, resolvedOptions);
      processedEntries = result.processedEntries;

      toolStats = {
        original: originalToolCalls,
        removed: result.statistics.toolCallsRemoved,
        truncated: result.statistics.toolCallsTruncated,
        preserved: originalToolCalls - result.statistics.toolCallsRemoved,
      };
    }
    // AC-4.7: Clone without --strip-tools preserves all content (no-op for tool removal)

    // Generate new session ID
    const newSessionId = generateSessionId();

    // Update session header
    processedEntries = updateSessionHeader(processedEntries, newSessionId, sourceSessionId);

    // Determine output path
    const outputPath =
      options.outputPath || join(getSessionsDirectory(agentId), `${newSessionId}.jsonl`);

    // Write cloned session
    await writeSessionFile(outputPath, processedEntries);

    // Get new stats
    const newStats = await getSessionFileStats(outputPath);
    const newMessages = processedEntries.filter(isMessageEntry).length;

    // Register in session index (unless --no-register)
    if (!options.noRegister && !options.outputPath) {
      await addSessionToIndex(newSessionId, agentId, {
        displayName: `Clone of ${sourceSessionId.slice(0, 8)}`,
      });
    }

    // Calculate statistics
    const statistics = calculateCloneStatistics(
      originalStats.sizeBytes,
      newStats.sizeBytes,
      originalMessages,
      newMessages,
      toolStats
    );

    return {
      success: true,
      mode: "clone",
      sourceSessionId,
      clonedSessionId: newSessionId,
      clonedSessionPath: outputPath,
      statistics,
      resumeCommand: `openclaw resume ${newSessionId}`,
    };
  } catch (error) {
    throw new CloneOperationError(
      `Failed to clone session '${sourceSessionId}': ${(error as Error).message}`,
      error as Error
    );
  }
}

/**
 * Generate a new session ID (UUID v4).
 */
export function generateSessionId(): string {
  return randomUUID();
}

/**
 * Update session header with new ID and clone metadata.
 */
function updateSessionHeader(
  entries: SessionEntry[],
  newSessionId: string,
  sourceSessionId: string
): SessionEntry[] {
  return entries.map((entry, index) => {
    if (isSessionHeader(entry)) {
      return {
        ...entry,
        id: newSessionId,
        clonedFrom: sourceSessionId,
        clonedAt: new Date().toISOString(),
      } as SessionHeader & { clonedFrom: string; clonedAt: string };
    }
    return entry;
  });
}

/**
 * Calculate statistics for clone operation.
 */
export function calculateCloneStatistics(
  originalSize: number,
  newSize: number,
  originalMessages: number,
  newMessages: number,
  toolStats: {
    original: number;
    removed: number;
    truncated: number;
    preserved: number;
  }
): CloneStatistics {
  const reduction = originalSize > 0 ? ((originalSize - newSize) / originalSize) * 100 : 0;

  return {
    messagesOriginal: originalMessages,
    messagesCloned: newMessages,
    toolCallsOriginal: toolStats.original,
    toolCallsRemoved: toolStats.removed,
    toolCallsTruncated: toolStats.truncated,
    toolCallsPreserved: toolStats.preserved,
    sizeOriginal: originalSize,
    sizeCloned: newSize,
    reductionPercent: Math.max(0, reduction),
  };
}

/**
 * Count tool calls in entries.
 */
function countToolCalls(entries: readonly SessionEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    if (isMessageEntry(entry)) {
      count += getToolCallIds(entry).length;
    }
  }
  return count;
}
```

### 2. Implement Clone Command

Replace stubs in `src/commands/clone-command.ts`:

```typescript
import { defineCommand } from "citty";
import type { CloneOptions } from "../types/index.js";
import { executeClone } from "../core/clone-operation-executor.js";
import { formatCloneResultHuman, formatCloneResultJson } from "../output/result-formatter.js";
import { OccError } from "../errors.js";

export const cloneCommand = defineCommand({
  meta: {
    name: "clone",
    description: "Clone a session to a new file",
  },
  args: {
    sessionId: {
      type: "positional",
      description: "Source session ID (or partial)",
      required: true,
    },
    "strip-tools": {
      type: "string",
      description: "Strip tool calls using preset (default, aggressive, extreme)",
    },
    output: {
      type: "string",
      alias: "o",
      description: "Output path for cloned session",
    },
    "no-register": {
      type: "boolean",
      description: "Skip session index registration",
      default: false,
    },
    agent: {
      type: "string",
      description: "Agent ID (default: auto-detect or 'main')",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
      default: false,
    },
    verbose: {
      type: "boolean",
      description: "Show detailed statistics",
      default: false,
    },
  },
  async run({ args }) {
    try {
      const options: CloneOptions = {
        sourceSessionId: args.sessionId as string,
        agentId: args.agent,
        outputPath: args.output,
        toolRemoval: args["strip-tools"] ? { preset: args["strip-tools"] } : undefined,
        noRegister: args["no-register"],
        outputFormat: args.json ? "json" : "human",
        verbose: args.verbose,
      };

      const result = await executeClone(options);

      if (args.json) {
        console.log(formatCloneResultJson(result));
      } else {
        console.log(formatCloneResultHuman(result, args.verbose));
      }

      process.exitCode = 0;
    } catch (error) {
      if (args.json) {
        console.log(JSON.stringify({ success: false, error: (error as Error).message }));
      } else {
        console.error(`Error: ${(error as Error).message}`);
        if (error instanceof OccError) {
          if (error.code === "SESSION_NOT_FOUND") {
            console.error("Use 'occ list' to see available sessions");
          }
        }
      }
      process.exitCode = 1;
    }
  },
});
```

### 3. Update Session Types for Clone Metadata

Add to `src/types/session-types.ts` (extend SessionHeader):

```typescript
// Add these fields to SessionHeader interface or create extended type
export interface ClonedSessionHeader extends SessionHeader {
  clonedFrom?: string;
  clonedAt?: string;
}
```

## Constraints

- New session ID must be valid UUID v4
- Clone header must include clonedFrom and clonedAt
- Atomic write (no partial files)
- Index only updated when not using --no-register

## Verification

```bash
npm run typecheck
npm test
```

**Expected:**
- Typecheck passes
- All 42 tests pass (12 algorithm + 19 edit + 11 clone)

## Done When

- [ ] `src/core/clone-operation-executor.ts` fully implemented
- [ ] `src/commands/clone-command.ts` fully implemented
- [ ] Session header includes clone metadata
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (42 tests: 12 algorithm + 19 edit + 11 clone)
