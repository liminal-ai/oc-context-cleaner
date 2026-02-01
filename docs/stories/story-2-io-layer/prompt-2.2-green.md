# Prompt 2.2: IO Layer — Green

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Filesystem operations for reading, writing, and discovering sessions.

**Story 2:** IO layer implementation.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Story 2 Skeleton complete
- IO stubs exist

## Reference Documents

- Tech Design: `docs/tech-design.md` (IO section, paths)

## Task

Implement all IO modules.

### 1. Implement Session File Reader

Replace stubs in `src/io/session-file-reader.ts`:

```typescript
import { readFile, stat } from "node:fs/promises";
import type { SessionEntry, ParsedSession } from "../types/index.js";
import { parseJsonl, separateHeaderAndMessages } from "../core/session-parser.js";

/**
 * Read and parse a session file.
 */
export async function readSessionFile(filePath: string): Promise<ParsedSession> {
  const entries = await readSessionEntries(filePath);
  return separateHeaderAndMessages(entries, filePath);
}

/**
 * Read raw session entries without separating header.
 */
export async function readSessionEntries(filePath: string): Promise<SessionEntry[]> {
  const content = await readFile(filePath, "utf-8");
  return parseJsonl(content);
}

/**
 * Get file statistics for a session file.
 */
export async function getSessionFileStats(
  filePath: string
): Promise<{ sizeBytes: number; mtime: Date }> {
  const stats = await stat(filePath);
  return {
    sizeBytes: stats.size,
    mtime: stats.mtime,
  };
}
```

### 2. Implement Session File Writer

Replace stubs in `src/io/session-file-writer.ts`:

```typescript
import { writeFile, rename, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { SessionEntry } from "../types/index.js";
import { serializeToJsonl } from "../core/session-parser.js";

/**
 * Write session entries to a file atomically.
 *
 * Uses temp file + rename for atomicity.
 */
export async function writeSessionFile(
  filePath: string,
  entries: SessionEntry[]
): Promise<void> {
  const content = serializeToJsonl(entries);
  const dir = dirname(filePath);
  const tempPath = join(dir, `.tmp-${randomUUID()}.jsonl`);

  try {
    await writeFile(tempPath, content, "utf-8");
    await rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on failure
    try {
      await import("node:fs/promises").then((fs) => fs.unlink(tempPath));
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Copy a file atomically.
 */
export async function copyFileAtomic(sourcePath: string, destPath: string): Promise<void> {
  const content = await readFile(sourcePath);
  const dir = dirname(destPath);
  const tempPath = join(dir, `.tmp-${randomUUID()}`);

  try {
    await writeFile(tempPath, content);
    await rename(tempPath, destPath);
  } catch (error) {
    try {
      await import("node:fs/promises").then((fs) => fs.unlink(tempPath));
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
```

### 3. Implement Session Index Reader

Replace stubs in `src/io/session-index-reader.ts`:

```typescript
import { readFile } from "node:fs/promises";
import type { SessionsIndex, SessionIndexEntry } from "../types/index.js";
import { getSessionIndexPath } from "./paths.js";

/**
 * Read the session index for an agent.
 */
export async function readSessionIndex(agentId: string): Promise<SessionsIndex> {
  const indexPath = getSessionIndexPath(agentId);
  try {
    const content = await readFile(indexPath, "utf-8");
    return JSON.parse(content) as SessionsIndex;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {}; // No index file yet
    }
    throw error;
  }
}

/**
 * Get session entries sorted by modification time (newest first).
 */
export async function getSessionsSortedByTime(agentId: string): Promise<SessionIndexEntry[]> {
  const index = await readSessionIndex(agentId);
  const entries = Object.values(index);
  return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}
```

### 4. Implement Session Index Writer

Replace stubs in `src/io/session-index-writer.ts`:

```typescript
import { writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import type { SessionsIndex, SessionIndexEntry } from "../types/index.js";
import { getSessionIndexPath } from "./paths.js";
import { readSessionIndex } from "./session-index-reader.js";

/**
 * Add a session to the index.
 */
export async function addSessionToIndex(
  sessionId: string,
  agentId: string,
  metadata?: Partial<SessionIndexEntry>
): Promise<void> {
  const index = await readSessionIndex(agentId);

  index[sessionId] = {
    sessionId,
    updatedAt: Date.now(),
    ...metadata,
  };

  await writeIndexAtomic(agentId, index);
}

/**
 * Update a session's timestamp in the index.
 */
export async function updateSessionTimestamp(sessionId: string, agentId: string): Promise<void> {
  const index = await readSessionIndex(agentId);

  if (index[sessionId]) {
    index[sessionId].updatedAt = Date.now();
    await writeIndexAtomic(agentId, index);
  }
}

/**
 * Write index file atomically.
 */
async function writeIndexAtomic(agentId: string, index: SessionsIndex): Promise<void> {
  const indexPath = getSessionIndexPath(agentId);
  const dir = dirname(indexPath);
  const tempPath = join(dir, `.tmp-${randomUUID()}.json`);

  const content = JSON.stringify(index, null, 2);

  try {
    await writeFile(tempPath, content, "utf-8");
    await rename(tempPath, indexPath);
  } catch (error) {
    try {
      await import("node:fs/promises").then((fs) => fs.unlink(tempPath));
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
```

### 5. Implement Session Discovery

Replace stubs in `src/io/session-discovery.ts`:

```typescript
import { readdir, stat, access } from "node:fs/promises";
import { join } from "node:path";
import type { SessionIndexEntry } from "../types/index.js";
import {
  getStateDirectory,
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

/**
 * Resolve a session ID (full, partial, or auto-detect).
 */
export async function resolveSessionId(
  sessionId: string | undefined,
  agentId?: string
): Promise<string> {
  const resolvedAgent = resolveAgentId(agentId);

  // Verify agent exists
  if (!(await agentExists(resolvedAgent))) {
    const available = await listAvailableAgents();
    throw new AgentNotFoundError(
      `Agent '${resolvedAgent}' not found`,
      available.length > 0 ? available : undefined
    );
  }

  // Auto-detect if no session ID provided
  if (!sessionId) {
    return getCurrentSession(resolvedAgent);
  }

  // Try exact match first
  const exactPath = getSessionPath(sessionId, resolvedAgent);
  try {
    await access(exactPath);
    return sessionId;
  } catch {
    // Not an exact match, try partial
  }

  // Try partial match
  const matches = await findMatchingSessions(sessionId, resolvedAgent);

  if (matches.length === 0) {
    throw new SessionNotFoundError(sessionId);
  }

  if (matches.length === 1) {
    return matches[0];
  }

  throw new AmbiguousSessionError(sessionId, matches);
}

/**
 * Get the current session (most recently modified).
 */
export async function getCurrentSession(agentId: string): Promise<string> {
  // First try the index
  const sorted = await getSessionsSortedByTime(agentId);
  if (sorted.length > 0) {
    return sorted[0].sessionId;
  }

  // Fall back to filesystem scan
  const sessionsDir = getSessionsDirectory(agentId);
  try {
    const files = await readdir(sessionsDir);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl") && !f.includes(".backup."));

    if (jsonlFiles.length === 0) {
      throw new NoSessionsError(agentId);
    }

    // Get mtimes and sort
    const withStats = await Promise.all(
      jsonlFiles.map(async (file) => {
        const path = join(sessionsDir, file);
        const stats = await stat(path);
        return { file, mtime: stats.mtime };
      })
    );

    withStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Return session ID (filename without .jsonl)
    return withStats[0].file.replace(".jsonl", "");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NoSessionsError(agentId);
    }
    throw error;
  }
}

/**
 * Find sessions matching a partial ID.
 */
export async function findMatchingSessions(
  partial: string,
  agentId: string
): Promise<string[]> {
  const sessionsDir = getSessionsDirectory(agentId);

  try {
    const files = await readdir(sessionsDir);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl") && !f.includes(".backup."));

    const matches: string[] = [];
    for (const file of jsonlFiles) {
      const sessionId = file.replace(".jsonl", "");
      if (sessionId.startsWith(partial)) {
        matches.push(sessionId);
      }
    }

    return matches;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * List available agents.
 */
export async function listAvailableAgents(): Promise<string[]> {
  const agentsDir = join(getStateDirectory(), "agents");

  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Check if an agent exists.
 */
export async function agentExists(agentId: string): Promise<boolean> {
  const sessionsDir = getSessionsDirectory(agentId);

  try {
    await access(sessionsDir);
    return true;
  } catch {
    return false;
  }
}
```

## Constraints

- All writes must be atomic (temp file + rename)
- Handle missing files gracefully (ENOENT)
- Do NOT create tests for IO modules

## Verification

```bash
npm run typecheck
```

**Expected:** No type errors.

## Done When

- [ ] `src/io/session-file-reader.ts` fully implemented
- [ ] `src/io/session-file-writer.ts` fully implemented
- [ ] `src/io/session-index-reader.ts` fully implemented
- [ ] `src/io/session-index-writer.ts` fully implemented
- [ ] `src/io/session-discovery.ts` fully implemented
- [ ] `npm run typecheck` passes
- [ ] Previous tests still pass (`npm test`)
