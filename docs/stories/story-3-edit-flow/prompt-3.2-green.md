# Prompt 3.2: Edit Flow — Green

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Edit command with backup management.

**Story 3:** Implement edit flow to pass all 19 tests.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Story 3 Skeleton+Red complete
- 19 edit tests failing with NotImplementedError

## Reference Documents

- Tech Design: `docs/tech-design.md` (Flow 1, Backup Manager)
- Tests: `tests/commands/edit-command.test.ts`

## Task

Implement all modules to make edit tests pass.

### 1. Implement Backup Manager

Replace stubs in `src/core/backup-manager.ts`:

```typescript
import { readdir, unlink, access } from "node:fs/promises";
import { join } from "node:path";
import { getBackupPath, getSessionsDirectory, getSessionPath } from "../io/paths.js";
import { copyFileAtomic } from "../io/session-file-writer.js";
import { RestoreError } from "../errors.js";

const MAX_BACKUPS = 5;

/**
 * Create a backup of a session file.
 */
export async function createBackup(sessionPath: string, agentId: string): Promise<string> {
  // Extract session ID from path
  const sessionId = sessionPath.split("/").pop()?.replace(".jsonl", "") || "";

  // Get existing backup numbers
  const existingNumbers = await getBackupNumbers(sessionId, agentId);

  // Determine next backup number
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

  // Create backup
  const backupPath = getBackupPath(sessionId, nextNumber, agentId);
  await copyFileAtomic(sessionPath, backupPath);

  // Rotate if needed
  await rotateBackups(sessionId, agentId, MAX_BACKUPS);

  return backupPath;
}

/**
 * Find the most recent backup for a session.
 */
export async function findLatestBackup(
  sessionId: string,
  agentId: string
): Promise<string | null> {
  const numbers = await getBackupNumbers(sessionId, agentId);

  if (numbers.length === 0) {
    return null;
  }

  const maxNumber = Math.max(...numbers);
  return getBackupPath(sessionId, maxNumber, agentId);
}

/**
 * Restore a session from its most recent backup.
 */
export async function restoreFromBackup(sessionId: string, agentId: string): Promise<void> {
  const backupPath = await findLatestBackup(sessionId, agentId);

  if (!backupPath) {
    throw new RestoreError(`No backup found for session '${sessionId}'`);
  }

  const sessionPath = getSessionPath(sessionId, agentId);
  await copyFileAtomic(backupPath, sessionPath);
}

/**
 * Get all backup numbers for a session.
 */
export async function getBackupNumbers(sessionId: string, agentId: string): Promise<number[]> {
  const sessionsDir = getSessionsDirectory(agentId);

  try {
    const files = await readdir(sessionsDir);
    const backupPattern = new RegExp(`^${sessionId}\\.backup\\.(\\d+)\\.jsonl$`);

    const numbers: number[] = [];
    for (const file of files) {
      const match = file.match(backupPattern);
      if (match) {
        numbers.push(parseInt(match[1], 10));
      }
    }

    return numbers.sort((a, b) => a - b);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Rotate backups to maintain max count.
 */
export async function rotateBackups(
  sessionId: string,
  agentId: string,
  maxBackups: number = MAX_BACKUPS
): Promise<void> {
  const numbers = await getBackupNumbers(sessionId, agentId);

  if (numbers.length <= maxBackups) {
    return;
  }

  // Delete oldest backups
  const toDelete = numbers.slice(0, numbers.length - maxBackups);

  for (const num of toDelete) {
    const path = getBackupPath(sessionId, num, agentId);
    try {
      await unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
```

### 2. Implement Edit Operation Executor

Replace stubs in `src/core/edit-operation-executor.ts`:

```typescript
import type {
  EditOptions,
  EditResult,
  EditStatistics,
  ResolvedToolRemovalOptions,
} from "../types/index.js";
import { resolveSessionId } from "../io/session-discovery.js";
import { readSessionEntries, getSessionFileStats } from "../io/session-file-reader.js";
import { writeSessionFile } from "../io/session-file-writer.js";
import { getSessionPath, resolveAgentId } from "../io/paths.js";
import { createBackup } from "./backup-manager.js";
import { removeToolCalls } from "./tool-call-remover.js";
import { resolveToolRemovalOptions } from "../config/tool-removal-presets.js";
import { EditOperationError } from "../errors.js";
import { isMessageEntry } from "./session-parser.js";
import { getToolCallIds } from "./turn-boundary-calculator.js";

/**
 * Execute edit operation on a session.
 */
export async function executeEdit(options: EditOptions): Promise<EditResult> {
  const agentId = resolveAgentId(options.agentId);

  // Resolve session ID (may auto-detect)
  const sessionId = await resolveSessionId(options.sessionId, agentId);
  const sessionPath = getSessionPath(sessionId, agentId);

  try {
    // Get original stats
    const originalStats = await getSessionFileStats(sessionPath);

    // Read session
    const entries = await readSessionEntries(sessionPath);

    // Count original tool calls
    const originalToolCalls = countToolCalls(entries);
    const originalMessages = entries.filter(isMessageEntry).length;

    // Create backup
    const backupPath = await createBackup(sessionPath, agentId);

    // Apply tool removal if specified
    let processedEntries = entries;
    let toolStats = {
      original: originalToolCalls,
      removed: 0,
      truncated: 0,
      preserved: originalToolCalls,
    };

    if (options.toolRemoval) {
      const resolvedOptions = resolveToolRemovalOptions(options.toolRemoval);
      const result = removeToolCalls(entries, resolvedOptions);
      processedEntries = result.processedEntries;

      toolStats = {
        original: originalToolCalls,
        removed: result.statistics.toolCallsRemoved,
        truncated: result.statistics.toolCallsTruncated,
        preserved:
          originalToolCalls - result.statistics.toolCallsRemoved,
      };
    }

    // Write modified session
    await writeSessionFile(sessionPath, processedEntries);

    // Get new stats
    const newStats = await getSessionFileStats(sessionPath);
    const newMessages = processedEntries.filter(isMessageEntry).length;

    // Calculate statistics
    const statistics = calculateEditStatistics(
      originalStats.sizeBytes,
      newStats.sizeBytes,
      originalMessages,
      newMessages,
      toolStats
    );

    return {
      success: true,
      mode: "edit",
      sessionId,
      backupPath,
      statistics,
    };
  } catch (error) {
    throw new EditOperationError(
      `Failed to edit session '${sessionId}': ${(error as Error).message}`,
      error as Error
    );
  }
}

/**
 * Calculate statistics for edit operation.
 */
export function calculateEditStatistics(
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
): EditStatistics {
  const reduction = originalSize > 0 ? ((originalSize - newSize) / originalSize) * 100 : 0;

  return {
    messagesOriginal: originalMessages,
    messagesAfter: newMessages,
    toolCallsOriginal: toolStats.original,
    toolCallsRemoved: toolStats.removed,
    toolCallsTruncated: toolStats.truncated,
    toolCallsPreserved: toolStats.preserved,
    sizeOriginal: originalSize,
    sizeAfter: newSize,
    reductionPercent: Math.max(0, reduction),
  };
}

/**
 * Count tool calls in entries.
 */
function countToolCalls(entries: readonly import("../types/index.js").SessionEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    if (isMessageEntry(entry)) {
      count += getToolCallIds(entry).length;
    }
  }
  return count;
}
```

### 3. Create Tool Removal Presets

Create `src/config/tool-removal-presets.ts`:

```typescript
import type { ToolRemovalPreset, ToolRemovalOptions, ResolvedToolRemovalOptions } from "../types/index.js";
import { UnknownPresetError } from "../errors.js";

export const BUILT_IN_PRESETS: Record<string, ToolRemovalPreset> = {
  default: {
    name: "default",
    keepTurnsWithTools: 20,
    truncatePercent: 50,
  },
  aggressive: {
    name: "aggressive",
    keepTurnsWithTools: 10,
    truncatePercent: 50,
  },
  extreme: {
    name: "extreme",
    keepTurnsWithTools: 0,
    truncatePercent: 0,
  },
};

/**
 * Resolve a preset by name.
 */
export function resolvePreset(
  name: string,
  customPresets?: Record<string, ToolRemovalPreset>
): ToolRemovalPreset {
  // Check custom presets first
  if (customPresets?.[name]) {
    return customPresets[name];
  }

  // Check built-in presets
  if (BUILT_IN_PRESETS[name]) {
    return BUILT_IN_PRESETS[name];
  }

  throw new UnknownPresetError(name);
}

/**
 * Resolve tool removal options to concrete values.
 */
export function resolveToolRemovalOptions(
  options: ToolRemovalOptions,
  customPresets?: Record<string, ToolRemovalPreset>
): ResolvedToolRemovalOptions {
  const presetName = options.preset || "default";
  const preset = resolvePreset(presetName, customPresets);

  return {
    keepTurnsWithTools: options.keepTurnsWithTools ?? preset.keepTurnsWithTools,
    truncatePercent: options.truncatePercent ?? preset.truncatePercent,
  };
}
```

### 4. Implement Result Formatter

Replace stubs in `src/output/result-formatter.ts`:

```typescript
import type { EditResult, CloneResult } from "../types/index.js";

/**
 * Format edit result for human output.
 */
export function formatEditResultHuman(result: EditResult, verbose: boolean): string {
  const lines: string[] = [];

  lines.push(`✓ Session edited: ${result.sessionId}`);
  lines.push(
    `  Messages: ${result.statistics.messagesOriginal} → ${result.statistics.messagesAfter} ` +
      `(${formatPercent(
        ((result.statistics.messagesOriginal - result.statistics.messagesAfter) /
          result.statistics.messagesOriginal) *
          100
      )} reduction)`
  );
  lines.push(
    `  Tool calls: ${result.statistics.toolCallsRemoved} removed, ` +
      `${result.statistics.toolCallsTruncated} truncated, ` +
      `${result.statistics.toolCallsPreserved} preserved`
  );
  lines.push(
    `  Size: ${formatFileSize(result.statistics.sizeOriginal)} → ` +
      `${formatFileSize(result.statistics.sizeAfter)} ` +
      `(${formatPercent(result.statistics.reductionPercent)} reduction)`
  );
  lines.push(`  Backup: ${result.backupPath}`);

  if (verbose) {
    lines.push("");
    lines.push("Statistics:");
    lines.push(`  Messages original:     ${result.statistics.messagesOriginal}`);
    lines.push(`  Messages after:        ${result.statistics.messagesAfter}`);
    lines.push(`  Tool calls original:   ${result.statistics.toolCallsOriginal}`);
    lines.push(`  Tool calls removed:    ${result.statistics.toolCallsRemoved}`);
    lines.push(`  Tool calls truncated:  ${result.statistics.toolCallsTruncated}`);
    lines.push(`  Tool calls preserved:  ${result.statistics.toolCallsPreserved}`);
    lines.push(`  Size original:         ${formatFileSize(result.statistics.sizeOriginal)}`);
    lines.push(`  Size after:            ${formatFileSize(result.statistics.sizeAfter)}`);
    lines.push(`  Reduction:             ${formatPercent(result.statistics.reductionPercent)}`);
  }

  return lines.join("\n");
}

/**
 * Format edit result for JSON output.
 */
export function formatEditResultJson(result: EditResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format clone result for human output.
 */
export function formatCloneResultHuman(result: CloneResult, verbose: boolean): string {
  const lines: string[] = [];

  lines.push(`✓ Session cloned: ${result.sourceSessionId} → ${result.clonedSessionId}`);
  lines.push(
    `  Messages: ${result.statistics.messagesOriginal} → ${result.statistics.messagesCloned}`
  );
  lines.push(
    `  Tool calls: ${result.statistics.toolCallsRemoved} removed, ` +
      `${result.statistics.toolCallsTruncated} truncated, ` +
      `${result.statistics.toolCallsPreserved} preserved`
  );
  lines.push(
    `  Size: ${formatFileSize(result.statistics.sizeOriginal)} → ` +
      `${formatFileSize(result.statistics.sizeCloned)} ` +
      `(${formatPercent(result.statistics.reductionPercent)} reduction)`
  );

  if (result.resumeCommand) {
    lines.push(`  Resume: ${result.resumeCommand}`);
  }

  if (verbose) {
    lines.push("");
    lines.push("Statistics:");
    lines.push(`  Messages original:     ${result.statistics.messagesOriginal}`);
    lines.push(`  Messages cloned:       ${result.statistics.messagesCloned}`);
    lines.push(`  Tool calls original:   ${result.statistics.toolCallsOriginal}`);
    lines.push(`  Tool calls removed:    ${result.statistics.toolCallsRemoved}`);
    lines.push(`  Tool calls truncated:  ${result.statistics.toolCallsTruncated}`);
    lines.push(`  Tool calls preserved:  ${result.statistics.toolCallsPreserved}`);
  }

  return lines.join("\n");
}

/**
 * Format clone result for JSON output.
 */
export function formatCloneResultJson(result: CloneResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format percentage.
 */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
```

### 5. Implement Edit Command

Replace stubs in `src/commands/edit-command.ts`:

```typescript
import { defineCommand } from "citty";
import type { EditOptions } from "../types/index.js";
import { executeEdit } from "../core/edit-operation-executor.js";
import { formatEditResultHuman, formatEditResultJson } from "../output/result-formatter.js";
import { resolveAgentId } from "../io/paths.js";
import { OccError } from "../errors.js";

export const editCommand = defineCommand({
  meta: {
    name: "edit",
    description: "Edit a session in place with automatic backup",
  },
  args: {
    sessionId: {
      type: "positional",
      description: "Session ID (or partial). Omit to auto-detect current session.",
      required: false,
    },
    "strip-tools": {
      type: "string",
      description: "Strip tool calls using preset (default, aggressive, extreme)",
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
      const options: EditOptions = {
        sessionId: args.sessionId as string | undefined,
        agentId: args.agent,
        toolRemoval: args["strip-tools"] ? { preset: args["strip-tools"] } : undefined,
        outputFormat: args.json ? "json" : "human",
        verbose: args.verbose,
      };

      const result = await executeEdit(options);

      if (args.json) {
        console.log(formatEditResultJson(result));
      } else {
        console.log(formatEditResultHuman(result, args.verbose));
      }

      process.exitCode = 0;
    } catch (error) {
      if (args.json) {
        console.log(JSON.stringify({ success: false, error: (error as Error).message }));
      } else {
        console.error(`Error: ${(error as Error).message}`);
        if (error instanceof OccError) {
          // Add resolution hints based on error type
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

## Constraints

- Ensure atomic operations (backup before edit)
- Preserve session ID in edited file
- Handle errors gracefully

## Verification

```bash
npm run typecheck
npm test
```

**Expected:**
- Typecheck passes
- All 27 tests pass (8 algorithm + 19 edit)

## Done When

- [ ] `src/core/backup-manager.ts` fully implemented
- [ ] `src/core/edit-operation-executor.ts` fully implemented
- [ ] `src/config/tool-removal-presets.ts` created
- [ ] `src/output/result-formatter.ts` fully implemented
- [ ] `src/commands/edit-command.ts` fully implemented
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (27 tests)
