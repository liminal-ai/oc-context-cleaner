# Prompt 5.1: Support Commands — Skeleton + Red

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Supporting commands for session discovery, analysis, and recovery.

**Story 5:** List, info, and restore commands.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Stories 0-4 complete

## Reference Documents

- Tech Design: `docs/tech-design.md` (Flows 3, 4, 5)
- Feature Spec: `docs/feature-spec.md` (AC-1.x, AC-2.x, AC-6.3, AC-6.4)

## Task

Create skeleton implementations and tests for list, info, and restore commands.

### 1. Create List Formatter

Create `src/output/list-formatter.ts`:

```typescript
import type { SessionIndexEntry } from "../types/index.js";
import { NotImplementedError } from "../errors.js";

/**
 * Format session list for human output.
 */
export function formatSessionListHuman(sessions: SessionIndexEntry[]): string {
  throw new NotImplementedError("formatSessionListHuman");
}

/**
 * Format session list for JSON output.
 */
export function formatSessionListJson(sessions: SessionIndexEntry[]): string {
  throw new NotImplementedError("formatSessionListJson");
}

/**
 * Format relative time (e.g., "2 hours ago").
 */
export function formatRelativeTime(timestamp: number): string {
  throw new NotImplementedError("formatRelativeTime");
}

/**
 * Truncate session ID for display.
 */
export function truncateSessionId(sessionId: string, length: number = 12): string {
  throw new NotImplementedError("truncateSessionId");
}
```

### 2. Create Info Formatter

Create `src/output/info-formatter.ts`:

```typescript
import type { SessionInfo } from "../types/index.js";
import { NotImplementedError } from "../errors.js";

/**
 * Format session info for human output.
 */
export function formatSessionInfoHuman(info: SessionInfo): string {
  throw new NotImplementedError("formatSessionInfoHuman");
}

/**
 * Format session info for JSON output.
 */
export function formatSessionInfoJson(info: SessionInfo): string {
  throw new NotImplementedError("formatSessionInfoJson");
}
```

### 3. Create List Command Skeleton

Create `src/commands/list-command.ts`:

```typescript
import { defineCommand } from "citty";
import { NotImplementedError } from "../errors.js";

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List available sessions",
  },
  args: {
    limit: {
      type: "string",
      alias: "n",
      description: "Limit number of results",
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
  },
  async run({ args }) {
    throw new NotImplementedError("list command run");
  },
});
```

### 4. Create Info Command Skeleton

Create `src/commands/info-command.ts`:

```typescript
import { defineCommand } from "citty";
import { NotImplementedError } from "../errors.js";

export const infoCommand = defineCommand({
  meta: {
    name: "info",
    description: "Show session statistics",
  },
  args: {
    sessionId: {
      type: "positional",
      description: "Session ID (or partial)",
      required: true,
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
  },
  async run({ args }) {
    throw new NotImplementedError("info command run");
  },
});
```

### 5. Create Restore Command Skeleton

Create `src/commands/restore-command.ts`:

```typescript
import { defineCommand } from "citty";
import { NotImplementedError } from "../errors.js";

export const restoreCommand = defineCommand({
  meta: {
    name: "restore",
    description: "Restore session from backup",
  },
  args: {
    sessionId: {
      type: "positional",
      description: "Session ID (or partial)",
      required: true,
    },
    agent: {
      type: "string",
      description: "Agent ID (default: auto-detect or 'main')",
    },
  },
  async run({ args }) {
    throw new NotImplementedError("restore command run");
  },
});
```

### 6. Create List Command Tests

Create `tests/commands/list-command.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";

vi.mock("node:fs/promises", async () => {
  const memfs = await import("memfs");
  return memfs.fs.promises;
});

import { getSessionsSortedByTime } from "../../src/io/session-index-reader.js";
import { formatSessionListHuman, formatSessionListJson, formatRelativeTime, truncateSessionId } from "../../src/output/list-formatter.js";
import { listAvailableAgents } from "../../src/io/session-discovery.js";

describe("list-command", () => {
  const testAgentId = "main";
  const sessionsDir = `/mock/.clawdbot/agents/${testAgentId}/sessions`;

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(sessionsDir, { recursive: true });
    vi.stubEnv("CLAWDBOT_STATE_DIR", "/mock/.clawdbot");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // TC-1.1a: List displays all sessions
  it("displays all sessions", async () => {
    const index = {
      "session-1": { sessionId: "session-1", updatedAt: Date.now() - 1000 },
      "session-2": { sessionId: "session-2", updatedAt: Date.now() - 2000 },
      "session-3": { sessionId: "session-3", updatedAt: Date.now() - 3000 },
      "session-4": { sessionId: "session-4", updatedAt: Date.now() - 4000 },
      "session-5": { sessionId: "session-5", updatedAt: Date.now() - 5000 },
    };
    vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

    const sessions = await getSessionsSortedByTime(testAgentId);
    expect(sessions.length).toBe(5);
  });

  // TC-1.2a: Sessions sorted by recency
  it("sessions sorted by recency", async () => {
    const now = Date.now();
    const index = {
      oldest: { sessionId: "oldest", updatedAt: now - 3000 },
      middle: { sessionId: "middle", updatedAt: now - 2000 },
      newest: { sessionId: "newest", updatedAt: now - 1000 },
    };
    vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

    const sessions = await getSessionsSortedByTime(testAgentId);
    expect(sessions[0].sessionId).toBe("newest");
    expect(sessions[1].sessionId).toBe("middle");
    expect(sessions[2].sessionId).toBe("oldest");
  });

  // TC-1.3a: Entry shows required fields (truncated ID, relative time, project path)
  it("entry shows required fields", async () => {
    const index = {
      "test-session-abc123": {
        sessionId: "test-session-abc123",
        updatedAt: Date.now() - 3600000, // 1 hour ago
        projectPath: "/home/user/my-project",
      },
    };
    vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

    const sessions = await getSessionsSortedByTime(testAgentId);
    const output = formatSessionListHuman(sessions);

    // Should contain truncated ID
    expect(output).toContain("test-session");
    // Should contain relative time
    expect(output).toMatch(/hour|minutes/i);
    // Should contain project path (AC-1.3)
    expect(output).toContain("/home/user/my-project");
  });

  // TC-1.4a: Limit flag restricts output
  it("limit flag restricts output", async () => {
    const index: Record<string, { sessionId: string; updatedAt: number }> = {};
    for (let i = 0; i < 10; i++) {
      index[`session-${i}`] = { sessionId: `session-${i}`, updatedAt: Date.now() - i * 1000 };
    }
    vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

    const sessions = await getSessionsSortedByTime(testAgentId);
    const limited = sessions.slice(0, 3);
    expect(limited.length).toBe(3);
  });

  // TC-1.5a: JSON output is parseable
  it("JSON output is parseable", async () => {
    const index = {
      "session-1": { sessionId: "session-1", updatedAt: Date.now() },
    };
    vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

    const sessions = await getSessionsSortedByTime(testAgentId);
    const json = formatSessionListJson(sessions);
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].sessionId).toBe("session-1");
  });

  // TC-1.6a: Partial ID matching works
  // Covered by: "partial ID matching works for edit" in edit-command.test.ts
  // Covered by: "partial ID matching works for clone" in clone-command.test.ts

  // TC-1.6b: Ambiguous partial ID fails gracefully
  // Covered by: resolveSessionId throws AmbiguousIdError (tested in edit/clone commands)

  // TC-1.7a: Agent auto-detected from environment
  // Covered by: "auto-detects current session" in edit-command.test.ts (uses resolveAgentId)

  // TC-1.8a: Agent flag overrides auto-detection
  // Covered by: All command tests explicitly pass agentId to verify override works

  // TC-1.9a: Missing agent shows actionable error
  it("missing agent shows actionable error", async () => {
    // Create agents directory with some agents (but not "nonexistent")
    vol.mkdirSync("/mock/.clawdbot/agents/other-agent/sessions", { recursive: true });

    // Import and run the list command with non-existent agent
    const { listCommand } = await import("../../src/commands/list-command.js");

    // Capture stderr
    const errorOutput: string[] = [];
    const originalError = console.error;
    console.error = (msg: string) => errorOutput.push(msg);

    try {
      await listCommand.run({ args: { agent: "nonexistent", json: false } });
    } catch {
      // Expected to throw
    } finally {
      console.error = originalError;
    }

    // Error should contain actionable hint
    const output = errorOutput.join(" ");
    expect(output).toMatch(/not found|does not exist/i);
    expect(output).toMatch(/available agents|main|other-agent/i);
  });

  // TC-1.1b: List command entry point works
  it("list command entry point returns sessions", async () => {
    const index = {
      "session-1": { sessionId: "session-1", updatedAt: Date.now() - 1000 },
      "session-2": { sessionId: "session-2", updatedAt: Date.now() - 2000 },
    };
    vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

    const { listCommand } = await import("../../src/commands/list-command.js");

    // Capture stdout
    const output: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => output.push(msg);

    try {
      await listCommand.run({ args: { agent: testAgentId, json: false } });
    } finally {
      console.log = originalLog;
    }

    const result = output.join("\n");
    expect(result).toContain("session-1");
    expect(result).toContain("session-2");
  });

  // Helper: formatRelativeTime formats correctly
  it("formatRelativeTime formats correctly", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 30000)).toMatch(/seconds|just now/i);
    expect(formatRelativeTime(now - 3600000)).toMatch(/hour/i);
    expect(formatRelativeTime(now - 86400000)).toMatch(/day/i);
  });

  // Helper: truncateSessionId truncates long IDs
  it("truncateSessionId truncates long IDs", () => {
    const longId = "abc123-def456-ghi789-jkl012-mno345";
    const truncated = truncateSessionId(longId, 12);
    expect(truncated.length).toBeLessThanOrEqual(15); // 12 + "..."
    expect(truncated).toContain("abc123");
  });
});
```

### 7. Create Info Command Tests

Create `tests/commands/info-command.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";

vi.mock("node:fs/promises", async () => {
  const memfs = await import("memfs");
  return memfs.fs.promises;
});

import { readSessionFile, getSessionFileStats } from "../../src/io/session-file-reader.js";
import { formatSessionInfoHuman, formatSessionInfoJson } from "../../src/output/info-formatter.js";
import { createSessionWithTurns } from "../fixtures/sessions.js";
import { serializeToJsonl } from "../../src/core/session-parser.js";
import type { SessionInfo } from "../../src/types/index.js";

describe("info-command", () => {
  const testAgentId = "main";
  const testSessionId = "test-session-info";
  const sessionsDir = `/mock/.clawdbot/agents/${testAgentId}/sessions`;
  const sessionPath = `${sessionsDir}/${testSessionId}.jsonl`;

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(sessionsDir, { recursive: true });
    vi.stubEnv("CLAWDBOT_STATE_DIR", "/mock/.clawdbot");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // TC-2.1a: Info displays session statistics
  it("displays session statistics", async () => {
    const entries = createSessionWithTurns(5, 1);
    const header = entries.find((e) => e.type === "session");
    if (header && header.type === "session") header.id = testSessionId;
    vol.writeFileSync(sessionPath, serializeToJsonl(entries));

    const parsed = await readSessionFile(sessionPath);
    expect(parsed.messages.length).toBeGreaterThan(0);
  });

  // TC-2.2a: Message counts accurate
  it("message counts are accurate", async () => {
    const entries = createSessionWithTurns(3, 1);
    const header = entries.find((e) => e.type === "session");
    if (header && header.type === "session") header.id = testSessionId;
    vol.writeFileSync(sessionPath, serializeToJsonl(entries));

    const parsed = await readSessionFile(sessionPath);
    const userMessages = parsed.messages.filter((m) => m.message.role === "user").length;
    const assistantMessages = parsed.messages.filter((m) => m.message.role === "assistant").length;

    // Each turn: 1 user + 1 assistant with tool + 1 tool result + 1 assistant response
    expect(userMessages).toBe(3); // 3 turns
    expect(assistantMessages).toBe(6); // 2 per turn (tool call + response)
  });

  // TC-2.3a: Token estimation displayed
  it("token estimation displayed", async () => {
    const entries = createSessionWithTurns(3, 1);
    const header = entries.find((e) => e.type === "session");
    if (header && header.type === "session") header.id = testSessionId;
    const content = serializeToJsonl(entries);
    vol.writeFileSync(sessionPath, content);

    // Token estimation: ~4 chars per token
    const estimatedTokens = Math.round(content.length / 4);
    expect(estimatedTokens).toBeGreaterThan(0);
  });

  // TC-2.4a: File size displayed
  it("file size displayed", async () => {
    const entries = createSessionWithTurns(3, 1);
    const header = entries.find((e) => e.type === "session");
    if (header && header.type === "session") header.id = testSessionId;
    vol.writeFileSync(sessionPath, serializeToJsonl(entries));

    const stats = await getSessionFileStats(sessionPath);
    expect(stats.sizeBytes).toBeGreaterThan(0);
  });

  // TC-2.5a: Info JSON output complete
  it("JSON output is complete", async () => {
    const info: SessionInfo = {
      sessionId: testSessionId,
      totalMessages: 10,
      userMessages: 3,
      assistantMessages: 6,
      toolCalls: 3,
      toolResults: 3,
      estimatedTokens: 1500,
      fileSizeBytes: 6000,
    };

    const json = formatSessionInfoJson(info);
    const parsed = JSON.parse(json);

    expect(parsed.sessionId).toBe(testSessionId);
    expect(parsed.totalMessages).toBe(10);
    expect(parsed.estimatedTokens).toBe(1500);
  });

  // TC-2.6a: Error on invalid session ID with actionable message
  it("error on invalid session ID", async () => {
    // Import and run the info command with non-existent session
    const { infoCommand } = await import("../../src/commands/info-command.js");

    // Capture stderr
    const errorOutput: string[] = [];
    const originalError = console.error;
    console.error = (msg: string) => errorOutput.push(msg);

    try {
      await infoCommand.run({ args: { sessionId: "nonexistent", agent: testAgentId, json: false } });
    } catch {
      // Expected to throw
    } finally {
      console.error = originalError;
    }

    // Error should contain actionable hint (AC-2.6)
    const output = errorOutput.join(" ");
    expect(output).toMatch(/not found|does not exist/i);
    expect(output).toMatch(/occ list|available sessions/i);
  });

  // TC-2.7a: Empty session handled
  it("empty session handled", async () => {
    // Create session with just header, no messages
    const header = { type: "session", version: "0.49.3", id: testSessionId, timestamp: new Date().toISOString(), cwd: "/test" };
    vol.writeFileSync(sessionPath, JSON.stringify(header) + "\n");

    const parsed = await readSessionFile(sessionPath);
    expect(parsed.messages.length).toBe(0);
  });

  // TC-2.1b: Info command entry point works
  it("info command entry point displays statistics", async () => {
    // Set up session index so resolveSessionId works
    const index = { [testSessionId]: { sessionId: testSessionId, updatedAt: Date.now() } };
    vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

    // Create session file
    const entries = createSessionWithTurns(3, 1);
    const header = entries.find((e) => e.type === "session");
    if (header && header.type === "session") header.id = testSessionId;
    vol.writeFileSync(sessionPath, serializeToJsonl(entries));

    const { infoCommand } = await import("../../src/commands/info-command.js");

    // Capture stdout
    const output: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => output.push(msg);

    try {
      await infoCommand.run({ args: { sessionId: testSessionId, agent: testAgentId, json: false } });
    } finally {
      console.log = originalLog;
    }

    const result = output.join("\n");
    expect(result).toContain("Session:");
    expect(result).toContain(testSessionId);
    expect(result).toMatch(/messages|Messages/i);
  });
});
```

### 8. Create Restore Command Tests

Create `tests/commands/restore-command.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";

vi.mock("node:fs/promises", async () => {
  const memfs = await import("memfs");
  return memfs.fs.promises;
});

import { restoreFromBackup, findLatestBackup } from "../../src/core/backup-manager.js";
import { createSessionWithTurns } from "../fixtures/sessions.js";
import { serializeToJsonl } from "../../src/core/session-parser.js";

describe("restore-command", () => {
  const testAgentId = "main";
  const testSessionId = "test-session-restore";
  const sessionsDir = `/mock/.clawdbot/agents/${testAgentId}/sessions`;
  const sessionPath = `${sessionsDir}/${testSessionId}.jsonl`;

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(sessionsDir, { recursive: true });
    vi.stubEnv("CLAWDBOT_STATE_DIR", "/mock/.clawdbot");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // TC-6.3a: Restore recovers from backup
  it("restore recovers from backup", async () => {
    // Create original content
    const originalEntries = createSessionWithTurns(5, 1);
    const origHeader = originalEntries.find((e) => e.type === "session");
    if (origHeader && origHeader.type === "session") origHeader.id = testSessionId;
    const originalContent = serializeToJsonl(originalEntries);
    vol.writeFileSync(sessionPath, originalContent);

    // Create backup
    const backupPath = `${sessionsDir}/${testSessionId}.backup.1.jsonl`;
    vol.writeFileSync(backupPath, originalContent);

    // Modify current session
    const modifiedEntries = createSessionWithTurns(2, 0);
    const modHeader = modifiedEntries.find((e) => e.type === "session");
    if (modHeader && modHeader.type === "session") modHeader.id = testSessionId;
    vol.writeFileSync(sessionPath, serializeToJsonl(modifiedEntries));

    // Restore from backup
    await restoreFromBackup(testSessionId, testAgentId);

    // Verify restored content matches backup
    const restoredContent = vol.readFileSync(sessionPath, "utf-8");
    expect(restoredContent).toBe(originalContent);
  });

  // TC-6.4a: Restore fails gracefully without backup
  it("restore fails gracefully without backup", async () => {
    // Create session without backup
    const entries = createSessionWithTurns(3, 1);
    const header = entries.find((e) => e.type === "session");
    if (header && header.type === "session") header.id = testSessionId;
    vol.writeFileSync(sessionPath, serializeToJsonl(entries));

    // Attempt restore
    await expect(restoreFromBackup(testSessionId, testAgentId)).rejects.toThrow(/no backup/i);
  });

  // TC-6.3b: Restore command entry point works
  it("restore command entry point recovers session", async () => {
    // Set up session index
    const index = { [testSessionId]: { sessionId: testSessionId, updatedAt: Date.now() } };
    vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

    // Create original content and backup
    const originalEntries = createSessionWithTurns(5, 1);
    const origHeader = originalEntries.find((e) => e.type === "session");
    if (origHeader && origHeader.type === "session") origHeader.id = testSessionId;
    const originalContent = serializeToJsonl(originalEntries);

    // Create backup
    const backupPath = `${sessionsDir}/${testSessionId}.backup.1.jsonl`;
    vol.writeFileSync(backupPath, originalContent);

    // Modify current session
    const modifiedEntries = createSessionWithTurns(2, 0);
    const modHeader = modifiedEntries.find((e) => e.type === "session");
    if (modHeader && modHeader.type === "session") modHeader.id = testSessionId;
    vol.writeFileSync(sessionPath, serializeToJsonl(modifiedEntries));

    const { restoreCommand } = await import("../../src/commands/restore-command.js");

    // Capture stdout
    const output: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => output.push(msg);

    try {
      await restoreCommand.run({ args: { sessionId: testSessionId, agent: testAgentId } });
    } finally {
      console.log = originalLog;
    }

    // Verify command output
    const result = output.join("\n");
    expect(result).toMatch(/restored|Restored/i);

    // Verify content was restored
    const restoredContent = vol.readFileSync(sessionPath, "utf-8");
    expect(restoredContent).toBe(originalContent);
  });
});
```

## Constraints

- Stubs should throw `NotImplementedError`
- Tests use memfs
- Relative time formatting should be human-friendly

## Verification

```bash
npm run typecheck
npm test
```

**Expected:**
- Typecheck passes
- 42 previous tests pass
- 22 new tests fail with NotImplementedError

## Done When

- [ ] `src/output/list-formatter.ts` created with stubs
- [ ] `src/output/info-formatter.ts` created with stubs
- [ ] `src/commands/list-command.ts` created with stubs
- [ ] `src/commands/info-command.ts` created with stubs
- [ ] `src/commands/restore-command.ts` created with stubs
- [ ] `tests/commands/list-command.test.ts` created with 11 tests
- [ ] `tests/commands/info-command.test.ts` created with 8 tests
- [ ] `tests/commands/restore-command.test.ts` created with 3 tests
- [ ] `npm run typecheck` passes
- [ ] `npm test` runs (42 pass, 22 fail)
