# Prompt 3.1: Edit Flow — Skeleton + Red

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Edit command that modifies sessions in place with automatic backup.

**Story 3:** Complete edit flow with backup management.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Stories 0-2 complete
- IO layer implemented
- Core algorithm working

**Available Helpers from Prior Stories:**
- `getSessionFileStats` from `src/io/session-file-reader.ts` (Story 2)
- `isMessageEntry` from `src/core/session-parser.ts` (Story 1)
- `getToolCallIds` from `src/core/turn-boundary-calculator.ts` (Story 1)

## Reference Documents

- Tech Design: `docs/tech-design.md` (Flow 1: Edit Session, Backup Manager)
- Feature Spec: `docs/feature-spec.md` (AC-3.x, AC-6.x, AC-7.x)

## Task

Create skeleton implementations and comprehensive tests for the edit flow.

### 1. Create Backup Manager Skeleton

Create `src/core/backup-manager.ts`:

```typescript
import { readdir, unlink, copyFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { getBackupPath, getSessionsDirectory } from "../io/paths.js";
import { copyFileAtomic } from "../io/session-file-writer.js";
import { RestoreError, NotImplementedError } from "../errors.js";

/**
 * Create a backup of a session file.
 *
 * Uses monotonic numbering. Rotates to keep max 5 backups.
 *
 * @param sessionPath Path to session file
 * @param agentId Agent ID
 * @returns Path to created backup
 */
export async function createBackup(sessionPath: string, agentId: string): Promise<string> {
  throw new NotImplementedError("createBackup");
}

/**
 * Find the most recent backup for a session.
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 * @returns Path to most recent backup, or null if none
 */
export async function findLatestBackup(
  sessionId: string,
  agentId: string
): Promise<string | null> {
  throw new NotImplementedError("findLatestBackup");
}

/**
 * Restore a session from its most recent backup.
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 * @throws RestoreError if no backup exists
 */
export async function restoreFromBackup(sessionId: string, agentId: string): Promise<void> {
  throw new NotImplementedError("restoreFromBackup");
}

/**
 * Get all backup numbers for a session.
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 * @returns Array of backup numbers, sorted ascending
 */
export async function getBackupNumbers(sessionId: string, agentId: string): Promise<number[]> {
  throw new NotImplementedError("getBackupNumbers");
}

/**
 * Rotate backups to maintain max count.
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 * @param maxBackups Maximum backups to keep (default 5)
 */
export async function rotateBackups(
  sessionId: string,
  agentId: string,
  maxBackups: number = 5
): Promise<void> {
  throw new NotImplementedError("rotateBackups");
}
```

### 2. Create Edit Operation Executor Skeleton

Create `src/core/edit-operation-executor.ts`:

```typescript
import type { EditOptions, EditResult, EditStatistics } from "../types/index.js";
import { NotImplementedError } from "../errors.js";

/**
 * Execute edit operation on a session.
 *
 * Creates backup, applies tool stripping, writes back to original path.
 * Atomic operation—original unchanged if any step fails.
 *
 * @param options Edit operation options
 * @returns Edit result with statistics
 */
export async function executeEdit(options: EditOptions): Promise<EditResult> {
  throw new NotImplementedError("executeEdit");
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
  throw new NotImplementedError("calculateEditStatistics");
}
```

### 3. Create Result Formatter

Create `src/output/result-formatter.ts`:

```typescript
import type { EditResult, CloneResult } from "../types/index.js";
import { NotImplementedError } from "../errors.js";

/**
 * Format edit result for human output.
 */
export function formatEditResultHuman(result: EditResult, verbose: boolean): string {
  throw new NotImplementedError("formatEditResultHuman");
}

/**
 * Format edit result for JSON output.
 */
export function formatEditResultJson(result: EditResult): string {
  throw new NotImplementedError("formatEditResultJson");
}

/**
 * Format clone result for human output.
 */
export function formatCloneResultHuman(result: CloneResult, verbose: boolean): string {
  throw new NotImplementedError("formatCloneResultHuman");
}

/**
 * Format clone result for JSON output.
 */
export function formatCloneResultJson(result: CloneResult): string {
  throw new NotImplementedError("formatCloneResultJson");
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

### 4. Create Edit Command Skeleton

Create `src/commands/edit-command.ts`:

```typescript
import { defineCommand } from "citty";
import type { EditOptions } from "../types/index.js";
import { executeEdit } from "../core/edit-operation-executor.js";
import { formatEditResultHuman, formatEditResultJson } from "../output/result-formatter.js";
import { resolveSessionId } from "../io/session-discovery.js";
import { resolveAgentId } from "../io/paths.js";
import { OccError, NotImplementedError } from "../errors.js";

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
      default: "default",
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
    throw new NotImplementedError("edit command run");
  },
});
```

### 5. Create Edit Command Tests

Create `tests/commands/edit-command.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import type { EditResult } from "../../src/types/index.js";

// Mock the filesystem
vi.mock("node:fs/promises", async () => {
  const memfs = await import("memfs");
  return memfs.fs.promises;
});

// Import after mocking
import { executeEdit } from "../../src/core/edit-operation-executor.js";
import { createBackup, findLatestBackup, rotateBackups, getBackupNumbers } from "../../src/core/backup-manager.js";
import { resolveSessionId } from "../../src/io/session-discovery.js";
import { formatEditResultHuman, formatEditResultJson } from "../../src/output/result-formatter.js";
import { createSessionWithTurns } from "../fixtures/sessions.js";
import { serializeToJsonl } from "../../src/core/session-parser.js";

describe("edit-command", () => {
  const testAgentId = "main";
  const testSessionId = "test-session-abc123";
  const sessionsDir = `/mock/.clawdbot/agents/${testAgentId}/sessions`;
  const sessionPath = `${sessionsDir}/${testSessionId}.jsonl`;

  beforeEach(() => {
    vol.reset();
    // Set up mock filesystem
    vol.mkdirSync(sessionsDir, { recursive: true });

    // Create a test session with tools
    const entries = createSessionWithTurns(15, 1);
    // Override the random session ID
    if (entries[0].type === "session") {
      entries[0].id = testSessionId;
    }
    const content = serializeToJsonl(entries);
    vol.writeFileSync(sessionPath, content);

    // Create sessions.json index
    const index = {
      [testSessionId]: {
        sessionId: testSessionId,
        updatedAt: Date.now(),
      },
    };
    vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

    // Mock environment
    vi.stubEnv("CLAWDBOT_STATE_DIR", "/mock/.clawdbot");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // TC-3.1a: Edit modifies session in place
  it("edit modifies session in place", async () => {
    const originalContent = vol.readFileSync(sessionPath, "utf-8");

    const result = await executeEdit({
      sessionId: testSessionId,
      agentId: testAgentId,
      toolRemoval: { preset: "default" },
      outputFormat: "human",
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(result.sessionId).toBe(testSessionId);

    const newContent = vol.readFileSync(sessionPath, "utf-8");
    expect(newContent).not.toBe(originalContent);
  });

  // TC-3.2a: Backup created before modify
  it("backup created before modifying", async () => {
    const result = await executeEdit({
      sessionId: testSessionId,
      agentId: testAgentId,
      toolRemoval: { preset: "default" },
      outputFormat: "human",
      verbose: false,
    });

    expect(result.backupPath).toBeTruthy();
    expect(vol.existsSync(result.backupPath)).toBe(true);
  });

  // TC-3.3a: Text content preserved
  it("preserves text content", async () => {
    const result = await executeEdit({
      sessionId: testSessionId,
      agentId: testAgentId,
      toolRemoval: { preset: "default" },
      outputFormat: "human",
      verbose: false,
    });

    // Read and check that user messages are preserved
    const content = vol.readFileSync(sessionPath, "utf-8") as string;
    expect(content).toContain("User message for turn");
  });

  // TC-3.4a: Failed edit leaves original unchanged
  it("failed edit leaves original unchanged", async () => {
    const originalContent = vol.readFileSync(sessionPath, "utf-8");

    // Mock writeSessionFile to throw after backup is created
    const { writeSessionFile } = await import("../../src/io/session-file-writer.js");
    const writeSessionFileSpy = vi.spyOn(
      await import("../../src/io/session-file-writer.js"),
      "writeSessionFile"
    ).mockRejectedValueOnce(new Error("Simulated write failure"));

    try {
      await executeEdit({
        sessionId: testSessionId,
        agentId: testAgentId,
        toolRemoval: { preset: "default" },
        outputFormat: "human",
        verbose: false,
      });
    } catch {
      // Expected to throw
    }

    // Verify original file is unchanged
    const afterContent = vol.readFileSync(sessionPath, "utf-8");
    expect(afterContent).toBe(originalContent);

    writeSessionFileSpy.mockRestore();
  });

  // TC-3.5a: JSON output complete
  it("JSON output is complete", async () => {
    const result = await executeEdit({
      sessionId: testSessionId,
      agentId: testAgentId,
      toolRemoval: { preset: "default" },
      outputFormat: "json",
      verbose: false,
    });

    const json = formatEditResultJson(result);
    const parsed = JSON.parse(json);

    expect(parsed.success).toBe(true);
    expect(parsed.mode).toBe("edit");
    expect(parsed.sessionId).toBe(testSessionId);
    expect(parsed.backupPath).toBeTruthy();
    expect(parsed.statistics).toBeDefined();
    expect(parsed.statistics.messagesOriginal).toBeGreaterThan(0);
    expect(parsed.statistics.reductionPercent).toBeDefined();
  });

  // TC-3.6a: Partial ID matching works
  it("partial ID matching works for edit", async () => {
    const resolved = await resolveSessionId("test-session", testAgentId);
    expect(resolved).toBe(testSessionId);
  });

  // TC-3.7a: Session ID unchanged after edit
  it("session remains resumable after edit", async () => {
    await executeEdit({
      sessionId: testSessionId,
      agentId: testAgentId,
      toolRemoval: { preset: "default" },
      outputFormat: "human",
      verbose: false,
    });

    // Verify session ID in file is unchanged
    const content = vol.readFileSync(sessionPath, "utf-8") as string;
    const firstLine = content.split("\n")[0];
    const header = JSON.parse(firstLine);
    expect(header.id).toBe(testSessionId);
  });

  // TC-3.8a: Auto-detect current session
  it("auto-detects current session", async () => {
    const resolved = await resolveSessionId(undefined, testAgentId);
    expect(resolved).toBe(testSessionId);
  });

  // TC-3.8b: Auto-detect fails gracefully
  it("auto-detect fails gracefully outside session", async () => {
    // Remove all sessions
    vol.unlinkSync(sessionPath);
    vol.writeFileSync(`${sessionsDir}/sessions.json`, "{}");

    await expect(resolveSessionId(undefined, testAgentId)).rejects.toThrow();
  });

  // TC-6.1a: Backup created on edit
  it("backup created on edit", async () => {
    const result = await executeEdit({
      sessionId: testSessionId,
      agentId: testAgentId,
      toolRemoval: { preset: "default" },
      outputFormat: "human",
      verbose: false,
    });

    const backupExists = vol.existsSync(result.backupPath);
    expect(backupExists).toBe(true);
  });

  // TC-6.2a: Backup uses monotonic numbering
  it("backup uses monotonic numbering", async () => {
    // Create first backup
    const backupPath1 = await createBackup(sessionPath, testAgentId);
    expect(backupPath1).toContain(".backup.1.jsonl");

    // Create second backup
    const backupPath2 = await createBackup(sessionPath, testAgentId);
    expect(backupPath2).toContain(".backup.2.jsonl");
  });

  // TC-6.5a: Backup rotation at max 5
  it("backup rotation maintains max 5", async () => {
    // Create 5 backups
    for (let i = 1; i <= 5; i++) {
      const path = `${sessionsDir}/${testSessionId}.backup.${i}.jsonl`;
      vol.writeFileSync(path, "backup content");
    }

    // Create 6th backup
    const newBackupPath = await createBackup(sessionPath, testAgentId);

    // Should have deleted .backup.1 and created .backup.6
    expect(vol.existsSync(`${sessionsDir}/${testSessionId}.backup.1.jsonl`)).toBe(false);
    expect(newBackupPath).toContain(".backup.6.jsonl");

    const numbers = await getBackupNumbers(testSessionId, testAgentId);
    expect(numbers.length).toBe(5);
  });

  // TC-6.5b: Backups accumulate under limit
  it("backups accumulate up to limit", async () => {
    // Create 3 backups
    for (let i = 0; i < 3; i++) {
      await createBackup(sessionPath, testAgentId);
    }

    const numbers = await getBackupNumbers(testSessionId, testAgentId);
    expect(numbers.length).toBe(3);
  });

  // TC-7.1a: Default output is human-readable
  it("default output is human-readable", async () => {
    const result = await executeEdit({
      sessionId: testSessionId,
      agentId: testAgentId,
      toolRemoval: { preset: "default" },
      outputFormat: "human",
      verbose: false,
    });

    const output = formatEditResultHuman(result, false);
    expect(output).toContain("Session edited");
    expect(output).toContain(testSessionId.slice(0, 8)); // Truncated ID
  });

  // TC-7.2a: Human output includes required fields
  it("human output includes required fields", async () => {
    const result = await executeEdit({
      sessionId: testSessionId,
      agentId: testAgentId,
      toolRemoval: { preset: "default" },
      outputFormat: "human",
      verbose: false,
    });

    const output = formatEditResultHuman(result, false);
    expect(output).toContain("Messages");
    expect(output).toContain("Tool calls");
    expect(output).toContain("Backup");
  });

  // TC-7.4a: Verbose shows detailed statistics
  it("verbose shows detailed statistics", async () => {
    const result = await executeEdit({
      sessionId: testSessionId,
      agentId: testAgentId,
      toolRemoval: { preset: "default" },
      outputFormat: "human",
      verbose: true,
    });

    const output = formatEditResultHuman(result, true);
    expect(output).toContain("Statistics");
    // Should have more detail than non-verbose
    expect(output.length).toBeGreaterThan(formatEditResultHuman(result, false).length);
  });

  // TC-7.5a: Success returns exit code 0
  // Note: This tests the executor's success flag, not CLI exit codes.
  // The CLI wrapper (edit-command.ts) sets process.exitCode based on result.success.
  it("success returns exit code 0", async () => {
    const result = await executeEdit({
      sessionId: testSessionId,
      agentId: testAgentId,
      toolRemoval: { preset: "default" },
      outputFormat: "human",
      verbose: false,
    });

    expect(result.success).toBe(true);
  });

  // TC-7.5b: Failure returns non-zero
  // Note: This tests the executor throws on failure, not CLI exit codes.
  // The CLI wrapper (edit-command.ts) catches errors and sets process.exitCode = 1.
  it("failure returns non-zero exit code", async () => {
    await expect(
      executeEdit({
        sessionId: "nonexistent-session",
        agentId: testAgentId,
        toolRemoval: { preset: "default" },
        outputFormat: "human",
        verbose: false,
      })
    ).rejects.toThrow();
  });

  // TC-7.6a: Error messages are actionable
  it("error messages are actionable", async () => {
    try {
      await executeEdit({
        sessionId: "nonexistent",
        agentId: testAgentId,
        toolRemoval: { preset: "default" },
        outputFormat: "human",
        verbose: false,
      });
    } catch (error) {
      expect((error as Error).message).toContain("not found");
    }
  });
});
```

## Constraints

- Mock filesystem using `memfs` for tests
- All stubs should throw `NotImplementedError`
- Tests should fail with NotImplementedError, not type errors

## Verification

```bash
npm run typecheck
npm test
```

**Expected:**
- Typecheck passes
- Algorithm tests pass (8)
- Edit tests fail with NotImplementedError (19 failures expected)

## Done When

- [ ] `src/core/backup-manager.ts` created with stubs
- [ ] `src/core/edit-operation-executor.ts` created with stubs
- [ ] `src/output/result-formatter.ts` created with stubs
- [ ] `src/commands/edit-command.ts` created with stubs
- [ ] `tests/commands/edit-command.test.ts` created with 19 tests
- [ ] `npm run typecheck` passes
- [ ] `npm test` runs (8 pass, 19 fail with NotImplementedError)
