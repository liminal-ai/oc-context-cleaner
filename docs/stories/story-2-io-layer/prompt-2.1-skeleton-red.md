# Prompt 2.1: IO Layer — Skeleton + Red

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Filesystem operations for reading, writing, and discovering sessions.

**Story 2:** IO layer — paths, readers, writers, discovery. No tests in this story (tested via commands).

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Story 1 complete
- Core algorithm working

## Reference Documents

- Tech Design: `docs/tech-design.md` (Module Architecture, IO section)
- Feature Spec: `docs/feature-spec.md` (AC-1.6 through AC-1.9, AC-3.8)

## Task

Create skeleton implementations for all IO modules.

### 1. Create Path Utilities

Create `src/io/paths.ts`:

```typescript
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Default state directory for OpenClaw.
 */
export const DEFAULT_STATE_DIR = join(homedir(), ".clawdbot");

/**
 * Default agent ID.
 */
export const DEFAULT_AGENT_ID = "main";

/**
 * Get the state directory, respecting environment override.
 */
export function getStateDirectory(): string {
  return process.env.CLAWDBOT_STATE_DIR || DEFAULT_STATE_DIR;
}

/**
 * Get the sessions directory for an agent.
 */
export function getSessionsDirectory(agentId: string = DEFAULT_AGENT_ID): string {
  return join(getStateDirectory(), "agents", agentId, "sessions");
}

/**
 * Get the path to a session file.
 */
export function getSessionPath(sessionId: string, agentId: string = DEFAULT_AGENT_ID): string {
  return join(getSessionsDirectory(agentId), `${sessionId}.jsonl`);
}

/**
 * Get the path to the session index file.
 */
export function getSessionIndexPath(agentId: string = DEFAULT_AGENT_ID): string {
  return join(getSessionsDirectory(agentId), "sessions.json");
}

/**
 * Get the backup path for a session with monotonic numbering.
 */
export function getBackupPath(
  sessionId: string,
  backupNumber: number,
  agentId: string = DEFAULT_AGENT_ID
): string {
  return join(getSessionsDirectory(agentId), `${sessionId}.backup.${backupNumber}.jsonl`);
}

/**
 * Resolve agent ID from environment or flag.
 */
export function resolveAgentId(flagValue?: string): string {
  if (flagValue) return flagValue;
  return process.env.CLAWDBOT_AGENT_ID || DEFAULT_AGENT_ID;
}
```

### 2. Create Session File Reader

Create `src/io/session-file-reader.ts`:

```typescript
import { readFile, stat } from "node:fs/promises";
import type { SessionEntry, ParsedSession } from "../types/index.js";
import { parseJsonl, separateHeaderAndMessages } from "../core/session-parser.js";
import { NotImplementedError } from "../errors.js";

/**
 * Read and parse a session file.
 *
 * @param filePath Path to the session JSONL file
 * @returns Parsed session with header and messages
 */
export async function readSessionFile(filePath: string): Promise<ParsedSession> {
  throw new NotImplementedError("readSessionFile");
}

/**
 * Read raw session entries without separating header.
 *
 * @param filePath Path to the session JSONL file
 * @returns Array of session entries
 */
export async function readSessionEntries(filePath: string): Promise<SessionEntry[]> {
  throw new NotImplementedError("readSessionEntries");
}

/**
 * Get file statistics for a session file.
 *
 * @param filePath Path to the session file
 * @returns File size in bytes and modification time
 */
export async function getSessionFileStats(
  filePath: string
): Promise<{ sizeBytes: number; mtime: Date }> {
  throw new NotImplementedError("getSessionFileStats");
}
```

### 3. Create Session File Writer

Create `src/io/session-file-writer.ts`:

```typescript
import { writeFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { SessionEntry } from "../types/index.js";
import { serializeToJsonl } from "../core/session-parser.js";
import { NotImplementedError } from "../errors.js";

/**
 * Write session entries to a file atomically.
 *
 * Uses temp file + rename for atomicity.
 *
 * @param filePath Target file path
 * @param entries Session entries to write
 */
export async function writeSessionFile(
  filePath: string,
  entries: SessionEntry[]
): Promise<void> {
  throw new NotImplementedError("writeSessionFile");
}

/**
 * Copy a file atomically.
 *
 * @param sourcePath Source file path
 * @param destPath Destination file path
 */
export async function copyFileAtomic(sourcePath: string, destPath: string): Promise<void> {
  throw new NotImplementedError("copyFileAtomic");
}
```

### 4. Create Session Index Reader

Create `src/io/session-index-reader.ts`:

```typescript
import { readFile } from "node:fs/promises";
import type { SessionsIndex, SessionIndexEntry } from "../types/index.js";
import { getSessionIndexPath } from "./paths.js";
import { NotImplementedError } from "../errors.js";

/**
 * Read the session index for an agent.
 *
 * @param agentId Agent ID
 * @returns Session index object
 */
export async function readSessionIndex(agentId: string): Promise<SessionsIndex> {
  throw new NotImplementedError("readSessionIndex");
}

/**
 * Get session entries sorted by modification time (newest first).
 *
 * @param agentId Agent ID
 * @returns Array of session index entries
 */
export async function getSessionsSortedByTime(agentId: string): Promise<SessionIndexEntry[]> {
  throw new NotImplementedError("getSessionsSortedByTime");
}
```

### 5. Create Session Index Writer

Create `src/io/session-index-writer.ts`:

```typescript
import { readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { SessionsIndex, SessionIndexEntry } from "../types/index.js";
import { getSessionIndexPath } from "./paths.js";
import { NotImplementedError } from "../errors.js";

/**
 * Add a session to the index.
 *
 * Uses atomic write (temp + rename).
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 * @param metadata Optional metadata
 */
export async function addSessionToIndex(
  sessionId: string,
  agentId: string,
  metadata?: Partial<SessionIndexEntry>
): Promise<void> {
  throw new NotImplementedError("addSessionToIndex");
}

/**
 * Update a session's timestamp in the index.
 *
 * @param sessionId Session ID
 * @param agentId Agent ID
 */
export async function updateSessionTimestamp(sessionId: string, agentId: string): Promise<void> {
  throw new NotImplementedError("updateSessionTimestamp");
}
```

### 6. Create Session Discovery

Create `src/io/session-discovery.ts`:

```typescript
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { SessionIndexEntry } from "../types/index.js";
import {
  getSessionsDirectory,
  getSessionPath,
  resolveAgentId,
} from "./paths.js";
import { readSessionIndex, getSessionsSortedByTime } from "./session-index-reader.js";
import {
  SessionNotFoundError,
  AmbiguousSessionError,
  NoSessionsError,
  AgentNotFoundError,
} from "../errors.js";
import { NotImplementedError } from "../errors.js";

/**
 * Resolve a session ID (full, partial, or auto-detect).
 *
 * Resolution order:
 * 1. If undefined, return most-recently-modified session
 * 2. If exact match exists, return it
 * 3. If partial match is unique, return it
 * 4. If ambiguous, throw with matching sessions
 *
 * @param sessionId Session ID or partial, or undefined for auto
 * @param agentId Agent ID
 * @returns Full session ID
 */
export async function resolveSessionId(
  sessionId: string | undefined,
  agentId?: string
): Promise<string> {
  throw new NotImplementedError("resolveSessionId");
}

/**
 * Get the current session (most recently modified).
 *
 * @param agentId Agent ID
 * @returns Session ID of most recent session
 */
export async function getCurrentSession(agentId: string): Promise<string> {
  throw new NotImplementedError("getCurrentSession");
}

/**
 * Find sessions matching a partial ID.
 *
 * @param partial Partial session ID
 * @param agentId Agent ID
 * @returns Array of matching session IDs
 */
export async function findMatchingSessions(
  partial: string,
  agentId: string
): Promise<string[]> {
  throw new NotImplementedError("findMatchingSessions");
}

/**
 * List available agents.
 *
 * @returns Array of agent IDs
 */
export async function listAvailableAgents(): Promise<string[]> {
  throw new NotImplementedError("listAvailableAgents");
}

/**
 * Check if an agent exists.
 *
 * @param agentId Agent ID
 * @returns True if agent exists
 */
export async function agentExists(agentId: string): Promise<boolean> {
  throw new NotImplementedError("agentExists");
}
```

## Constraints

- All functions should throw `NotImplementedError` for now
- Path utilities are fully implemented (no stubs)
- Do NOT create tests for IO modules (tested via commands)

## Verification

```bash
npm run typecheck
```

**Expected:** No type errors.

## Done When

- [ ] `src/io/paths.ts` created (fully implemented)
- [ ] `src/io/session-file-reader.ts` created with stubs
- [ ] `src/io/session-file-writer.ts` created with stubs
- [ ] `src/io/session-index-reader.ts` created with stubs
- [ ] `src/io/session-index-writer.ts` created with stubs
- [ ] `src/io/session-discovery.ts` created with stubs
- [ ] `npm run typecheck` passes
