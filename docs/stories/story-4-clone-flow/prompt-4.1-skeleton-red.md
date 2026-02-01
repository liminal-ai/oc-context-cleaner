# Prompt 4.1: Clone Flow — Skeleton + Red

> **Note:** This prompt combines skeleton and red phases following the established pattern from previous stories.

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Clone command that creates new sessions from existing ones.

**Story 4:** Complete clone flow with index registration.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Stories 0-3 complete
- Edit flow implemented
- `npm test` passes (31 tests: 12 algorithm + 19 edit)

**Note:** Story 2 has 0 direct tests; IO is tested through command tests.

## Reference Documents

- Tech Design: `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner/docs/tech-design.md` (Flow 2: Clone Session)
- Feature Spec: `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner/docs/feature-spec.md` (AC-4.x)

## Type Definitions (Reference)

These types are defined in `src/types/operation-types.ts`. Included here for reference:

```typescript
import type { ToolRemovalOptions } from "./tool-removal-types.js";

/**
 * Options for clone operation.
 *
 * Note: agentId is optional. When omitted, the system auto-detects using
 * the CLAWDBOT_AGENT_ID env var or defaults to "main".
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
 * Uses "messagesCloned" / "sizeCloned" per spec contract.
 */
export interface CloneStatistics {
  messagesOriginal: number;
  messagesCloned: number;      // Note: "Cloned" not "After" per spec
  toolCallsOriginal: number;
  toolCallsRemoved: number;
  toolCallsTruncated: number;
  toolCallsPreserved: number;
  sizeOriginal: number;        // bytes
  sizeCloned: number;          // Note: "Cloned" not "After" per spec
  reductionPercent: number;
}

/**
 * Result of clone operation.
 * Matches spec's CloneResult contract exactly.
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
```

## Task

Create skeleton implementations and tests for the clone flow.

### 1. Create Clone Operation Executor Skeleton

Create `src/core/clone-operation-executor.ts`:

```typescript
import type { CloneOptions, CloneResult, CloneStatistics } from "../types/index.js";
import { NotImplementedError } from "../errors.js";

/**
 * Execute clone operation on a session.
 *
 * Creates new session file with new UUID, optionally strips tools,
 * optionally registers in session index.
 *
 * @param options Clone operation options
 * @returns Clone result with new session ID and statistics
 */
export async function executeClone(options: CloneOptions): Promise<CloneResult> {
  throw new NotImplementedError("executeClone");
}

/**
 * Generate a new session ID (UUID v4).
 */
export function generateSessionId(): string {
  throw new NotImplementedError("generateSessionId");
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
  throw new NotImplementedError("calculateCloneStatistics");
}
```

### 2. Create Clone Command Skeleton

Create `src/commands/clone-command.ts`:

```typescript
import { defineCommand } from "citty";
import type { CloneOptions } from "../types/index.js";
import { executeClone } from "../core/clone-operation-executor.js";
import { formatCloneResultHuman, formatCloneResultJson } from "../output/result-formatter.js";
import { OccError, NotImplementedError } from "../errors.js";

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
    throw new NotImplementedError("clone command run");
  },
});
```

### 3. Create Clone Command Tests

Create `tests/commands/clone-command.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import type { CloneResult } from "../../src/types/index.js";

// Mock the filesystem
vi.mock("node:fs/promises", async () => {
  const memfs = await import("memfs");
  return memfs.fs.promises;
});

// Import after mocking
import { executeClone } from "../../src/core/clone-operation-executor.js";
import { readSessionIndex } from "../../src/io/session-index-reader.js";
import { formatCloneResultJson } from "../../src/output/result-formatter.js";
import { createSessionWithTurns } from "../fixtures/sessions.js";
import { serializeToJsonl } from "../../src/core/session-parser.js";

// Note: generateSessionId and resolveSessionId are internal to executeClone
// and not needed as direct imports in tests.

describe("clone-command", () => {
  const testAgentId = "main";
  const testSessionId = "test-session-xyz789";
  const sessionsDir = `/mock/.clawdbot/agents/${testAgentId}/sessions`;
  const sessionPath = `${sessionsDir}/${testSessionId}.jsonl`;

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(sessionsDir, { recursive: true });

    // Create a test session with tools
    const entries = createSessionWithTurns(10, 1);
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

    vi.stubEnv("CLAWDBOT_STATE_DIR", "/mock/.clawdbot");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // TC-4.1a: Clone creates new UUID
  it("clone creates new session with new UUID", async () => {
    const result = await executeClone({
      sourceSessionId: testSessionId,
      agentId: testAgentId,
      noRegister: false,
      outputFormat: "human",
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(result.clonedSessionId).not.toBe(testSessionId);
    expect(result.clonedSessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  // TC-4.2a: Clone preserves text content
  it("clone preserves text content", async () => {
    const result = await executeClone({
      sourceSessionId: testSessionId,
      agentId: testAgentId,
      noRegister: false,
      outputFormat: "human",
      verbose: false,
    });

    const content = vol.readFileSync(result.clonedSessionPath, "utf-8") as string;
    expect(content).toContain("User message for turn");
  });

  // TC-4.3a: Header has clone metadata
  it("header has clone metadata", async () => {
    const result = await executeClone({
      sourceSessionId: testSessionId,
      agentId: testAgentId,
      noRegister: false,
      outputFormat: "human",
      verbose: false,
    });

    const content = vol.readFileSync(result.clonedSessionPath, "utf-8") as string;
    const firstLine = content.split("\n")[0];
    const header = JSON.parse(firstLine);

    expect(header.id).toBe(result.clonedSessionId);
    expect(header.clonedFrom).toBe(testSessionId);
    expect(header.clonedAt).toBeDefined();
  });

  // TC-4.4a: No partial file on failure (atomicity test)
  // This test verifies atomic write behavior: either complete success or no file.
  // In Red phase: NotImplementedError thrown → test ERRORs (correct TDD behavior)
  // In Green phase: result returned → assertions verify atomicity
  it("no partial file on failure", async () => {
    // Use a path in a non-existent directory to trigger write failure
    const badOutputPath = "/nonexistent/directory/output.jsonl";

    const result = await executeClone({
      sourceSessionId: testSessionId,
      agentId: testAgentId,
      outputPath: badOutputPath,
      noRegister: true,
      outputFormat: "human",
      verbose: false,
    });

    // Atomicity invariant: must be complete success OR complete failure
    // (no partial files left behind)
    expect(result.success).toBe(false); // Write to bad path should fail
    expect(vol.existsSync(badOutputPath)).toBe(false); // No partial file
  });

  // TC-4.5a: Custom output path respected
  it("custom output path respected", async () => {
    const customPath = "/mock/backup/my-clone.jsonl";
    vol.mkdirSync("/mock/backup", { recursive: true });

    const result = await executeClone({
      sourceSessionId: testSessionId,
      agentId: testAgentId,
      outputPath: customPath,
      noRegister: true,
      outputFormat: "human",
      verbose: false,
    });

    expect(result.clonedSessionPath).toBe(customPath);
    expect(vol.existsSync(customPath)).toBe(true);
  });

  // TC-4.6a: JSON output complete
  it("JSON output is complete", async () => {
    const result = await executeClone({
      sourceSessionId: testSessionId,
      agentId: testAgentId,
      noRegister: false,
      outputFormat: "json",
      verbose: false,
    });

    const json = formatCloneResultJson(result);
    const parsed = JSON.parse(json);

    expect(parsed.success).toBe(true);
    expect(parsed.mode).toBe("clone");
    expect(parsed.sourceSessionId).toBe(testSessionId);
    expect(parsed.clonedSessionId).toBeDefined();
    expect(parsed.clonedSessionPath).toBeDefined();
    expect(parsed.statistics).toBeDefined();
    expect(parsed.resumeCommand).toBeDefined();
  });

  // TC-4.7a: Clone without stripping preserves all
  it("clone without stripping preserves all content", async () => {
    const result = await executeClone({
      sourceSessionId: testSessionId,
      agentId: testAgentId,
      // No toolRemoval specified
      noRegister: false,
      outputFormat: "human",
      verbose: false,
    });

    // Should have same message count
    expect(result.statistics.messagesOriginal).toBe(result.statistics.messagesCloned);
    expect(result.statistics.toolCallsRemoved).toBe(0);
  });

  // TC-4.8a: Partial ID matching works
  it("partial ID matching works for clone", async () => {
    const result = await executeClone({
      sourceSessionId: "test-session", // Partial
      agentId: testAgentId,
      noRegister: false,
      outputFormat: "human",
      verbose: false,
    });

    expect(result.sourceSessionId).toBe(testSessionId);
  });

  // TC-4.9a: Clone updates session index
  it("clone updates session index", async () => {
    const result = await executeClone({
      sourceSessionId: testSessionId,
      agentId: testAgentId,
      noRegister: false,
      outputFormat: "human",
      verbose: false,
    });

    const index = await readSessionIndex(testAgentId);
    expect(index[result.clonedSessionId]).toBeDefined();
  });

  // TC-4.10a: No-register skips index
  it("no-register skips index update", async () => {
    const indexBefore = await readSessionIndex(testAgentId);
    const countBefore = Object.keys(indexBefore).length;

    const result = await executeClone({
      sourceSessionId: testSessionId,
      agentId: testAgentId,
      noRegister: true,
      outputFormat: "human",
      verbose: false,
    });

    const indexAfter = await readSessionIndex(testAgentId);
    const countAfter = Object.keys(indexAfter).length;

    expect(countAfter).toBe(countBefore);
    expect(indexAfter[result.clonedSessionId]).toBeUndefined();
  });

  // TC-7.3a: JSON output complete (also covers CloneResult)
  it("JSON output has all CloneResult fields", async () => {
    const result = await executeClone({
      sourceSessionId: testSessionId,
      agentId: testAgentId,
      toolRemoval: { preset: "default" },
      noRegister: false,
      outputFormat: "json",
      verbose: false,
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe("clone");
    expect(result.sourceSessionId).toBeDefined();
    expect(result.clonedSessionId).toBeDefined();
    expect(result.clonedSessionPath).toBeDefined();
    expect(result.statistics.messagesOriginal).toBeDefined();
    expect(result.statistics.messagesCloned).toBeDefined();
    expect(result.statistics.toolCallsOriginal).toBeDefined();
    expect(result.statistics.toolCallsRemoved).toBeDefined();
    expect(result.statistics.toolCallsTruncated).toBeDefined();
    expect(result.statistics.toolCallsPreserved).toBeDefined();
    expect(result.statistics.sizeOriginal).toBeDefined();
    expect(result.statistics.sizeCloned).toBeDefined();
    expect(result.statistics.reductionPercent).toBeDefined();
  });
});
```

## Constraints

- Stubs should throw `NotImplementedError`
- Tests use memfs for filesystem mocking
- Clone must use atomic write (temp + rename)

## Verification

```bash
npm run typecheck
npm run lint
npm test
```

**Expected:**
- Typecheck passes
- Lint passes
- 31 previous tests pass
- 11 clone tests ERROR with NotImplementedError

## Done When

- [ ] `src/core/clone-operation-executor.ts` created with stubs
- [ ] `src/commands/clone-command.ts` created with stubs
- [ ] `tests/commands/clone-command.test.ts` created with 11 tests
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` runs (31 pass, 11 ERROR due to NotImplementedError)
