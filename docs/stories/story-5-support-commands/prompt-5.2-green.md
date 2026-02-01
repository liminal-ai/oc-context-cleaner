# Prompt 5.2: Support Commands — Green

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** List, info, and restore commands.

**Story 5:** Implement support commands to pass all 19 tests.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Story 5 Skeleton+Red complete
- 19 support command tests failing

## Task

Implement all support command modules.

### 1. Implement List Formatter

Replace stubs in `src/output/list-formatter.ts`:

```typescript
import type { SessionIndexEntry } from "../types/index.js";

/**
 * Format session list for human output.
 */
export function formatSessionListHuman(sessions: SessionIndexEntry[]): string {
  if (sessions.length === 0) {
    return "No sessions found.";
  }

  const lines: string[] = [];
  lines.push("Sessions:");
  lines.push("");

  for (const session of sessions) {
    const id = truncateSessionId(session.sessionId);
    const time = formatRelativeTime(session.updatedAt);
    const label = session.displayName || session.label || "";

    if (label) {
      lines.push(`  ${id}  ${time}  ${label}`);
    } else {
      lines.push(`  ${id}  ${time}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format session list for JSON output.
 */
export function formatSessionListJson(sessions: SessionIndexEntry[]): string {
  return JSON.stringify(sessions, null, 2);
}

/**
 * Format relative time (e.g., "2 hours ago").
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

/**
 * Truncate session ID for display.
 */
export function truncateSessionId(sessionId: string, length: number = 12): string {
  if (sessionId.length <= length) {
    return sessionId;
  }
  return sessionId.slice(0, length) + "...";
}
```

### 2. Implement Info Formatter

Replace stubs in `src/output/info-formatter.ts`:

```typescript
import type { SessionInfo } from "../types/index.js";
import { formatFileSize } from "./result-formatter.js";

/**
 * Format session info for human output.
 */
export function formatSessionInfoHuman(info: SessionInfo): string {
  const lines: string[] = [];

  lines.push(`Session: ${info.sessionId}`);
  lines.push("");
  lines.push("Statistics:");
  lines.push(`  Total messages:     ${info.totalMessages}`);
  lines.push(`  User messages:      ${info.userMessages}`);
  lines.push(`  Assistant messages: ${info.assistantMessages}`);
  lines.push(`  Tool calls:         ${info.toolCalls}`);
  lines.push(`  Tool results:       ${info.toolResults}`);
  lines.push("");
  lines.push(`  Estimated tokens:   ${info.estimatedTokens.toLocaleString()}`);
  lines.push(`  File size:          ${formatFileSize(info.fileSizeBytes)}`);

  return lines.join("\n");
}

/**
 * Format session info for JSON output.
 */
export function formatSessionInfoJson(info: SessionInfo): string {
  return JSON.stringify(info, null, 2);
}
```

### 3. Implement List Command

Replace stubs in `src/commands/list-command.ts`:

```typescript
import { defineCommand } from "citty";
import { getSessionsSortedByTime } from "../io/session-index-reader.js";
import { listAvailableAgents, agentExists } from "../io/session-discovery.js";
import { resolveAgentId } from "../io/paths.js";
import { formatSessionListHuman, formatSessionListJson } from "../output/list-formatter.js";
import { AgentNotFoundError, OccError } from "../errors.js";

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
    try {
      const agentId = resolveAgentId(args.agent);

      // Verify agent exists
      if (!(await agentExists(agentId))) {
        const available = await listAvailableAgents();
        throw new AgentNotFoundError(
          `Agent '${agentId}' not found`,
          available.length > 0 ? available : undefined
        );
      }

      let sessions = await getSessionsSortedByTime(agentId);

      // Apply limit if specified
      if (args.limit) {
        const limit = parseInt(args.limit, 10);
        if (!isNaN(limit) && limit > 0) {
          sessions = sessions.slice(0, limit);
        }
      }

      if (args.json) {
        console.log(formatSessionListJson(sessions));
      } else {
        console.log(formatSessionListHuman(sessions));
      }

      process.exitCode = 0;
    } catch (error) {
      if (args.json) {
        console.log(JSON.stringify({ success: false, error: (error as Error).message }));
      } else {
        console.error(`Error: ${(error as Error).message}`);
        if (error instanceof AgentNotFoundError && error.availableAgents) {
          console.error(`Available agents: ${error.availableAgents.join(", ")}`);
        }
      }
      process.exitCode = 1;
    }
  },
});
```

### 4. Implement Info Command

Replace stubs in `src/commands/info-command.ts`:

```typescript
import { defineCommand } from "citty";
import { resolveSessionId } from "../io/session-discovery.js";
import { readSessionFile, getSessionFileStats } from "../io/session-file-reader.js";
import { getSessionPath, resolveAgentId } from "../io/paths.js";
import { formatSessionInfoHuman, formatSessionInfoJson } from "../output/info-formatter.js";
import type { SessionInfo, MessageEntry, ToolCallBlock } from "../types/index.js";
import { OccError } from "../errors.js";

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
    try {
      const agentId = resolveAgentId(args.agent);
      const sessionId = await resolveSessionId(args.sessionId as string, agentId);
      const sessionPath = getSessionPath(sessionId, agentId);

      const parsed = await readSessionFile(sessionPath);
      const stats = await getSessionFileStats(sessionPath);

      const info = analyzeSession(sessionId, parsed.messages, stats.sizeBytes);

      if (args.json) {
        console.log(formatSessionInfoJson(info));
      } else {
        console.log(formatSessionInfoHuman(info));
      }

      process.exitCode = 0;
    } catch (error) {
      if (args.json) {
        console.log(JSON.stringify({ success: false, error: (error as Error).message }));
      } else {
        console.error(`Error: ${(error as Error).message}`);
        if (error instanceof OccError && error.code === "SESSION_NOT_FOUND") {
          console.error("Use 'occ list' to see available sessions");
        }
      }
      process.exitCode = 1;
    }
  },
});

/**
 * Analyze session and return statistics.
 */
function analyzeSession(
  sessionId: string,
  messages: MessageEntry[],
  fileSizeBytes: number
): SessionInfo {
  let userMessages = 0;
  let assistantMessages = 0;
  let toolCalls = 0;
  let toolResults = 0;
  let totalChars = 0;

  for (const entry of messages) {
    const role = entry.message.role;
    const content = entry.message.content;

    if (role === "user") {
      userMessages++;
    } else if (role === "assistant") {
      assistantMessages++;
    } else if (role === "toolResult") {
      toolResults++;
    }

    // Count tool calls
    if (typeof content !== "string") {
      for (const block of content) {
        if (block.type === "toolCall") {
          toolCalls++;
        }
        if (block.type === "text") {
          totalChars += block.text.length;
        }
      }
    } else {
      totalChars += content.length;
    }
  }

  // Estimate tokens (~4 chars per token)
  const estimatedTokens = Math.round(totalChars / 4);

  return {
    sessionId,
    totalMessages: messages.length,
    userMessages,
    assistantMessages,
    toolCalls,
    toolResults,
    estimatedTokens,
    fileSizeBytes,
  };
}
```

### 5. Implement Restore Command

Replace stubs in `src/commands/restore-command.ts`:

```typescript
import { defineCommand } from "citty";
import { resolveSessionId } from "../io/session-discovery.js";
import { restoreFromBackup, findLatestBackup } from "../core/backup-manager.js";
import { resolveAgentId } from "../io/paths.js";
import { OccError, RestoreError } from "../errors.js";

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
    try {
      const agentId = resolveAgentId(args.agent);
      const sessionId = await resolveSessionId(args.sessionId as string, agentId);

      await restoreFromBackup(sessionId, agentId);

      console.log(`✓ Session '${sessionId}' restored from backup`);
      process.exitCode = 0;
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      if (error instanceof RestoreError) {
        console.error("No backup available for this session");
      }
      process.exitCode = 1;
    }
  },
});
```

## Constraints

- List should handle empty session index gracefully
- Info should handle sessions with no messages
- Restore should use most recent backup (highest number)

## Verification

```bash
npm run typecheck
npm test
```

**Expected:**
- Typecheck passes
- All 57 tests pass

## Done When

- [ ] `src/output/list-formatter.ts` fully implemented
- [ ] `src/output/info-formatter.ts` fully implemented
- [ ] `src/commands/list-command.ts` fully implemented
- [ ] `src/commands/info-command.ts` fully implemented
- [ ] `src/commands/restore-command.ts` fully implemented
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (57 tests)
