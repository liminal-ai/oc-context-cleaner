# Prompt 0.1: Infrastructure Setup

## Context

**Product:** oc-context-cleaner — A CLI tool for cleaning OpenClaw agent session transcripts by stripping old tool calls to reduce context consumption.

**Project:** CLI tool that edits sessions in place (primary) or clones to new files (fallback). Agents like Molt invoke this to self-maintain context without human intervention.

**Feature:** Complete CLI with edit, clone, list, info, restore commands. Tool stripping uses turn-based presets (default keeps 20 turns, truncates oldest 50%).

**Story 0:** Infrastructure setup — types, error classes, fixtures. No runtime behavior.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

## Reference Documents

- Tech Design: `docs/tech-design.md` (Low Altitude: Interface Definitions)
- Feature Spec: `docs/feature-spec.md` (Data Contracts)

## Task

Create the foundational infrastructure for the project. All code must compile. No runtime implementation yet.

### 1. Initialize Project

Create `package.json`:

```json
{
  "name": "oc-context-cleaner",
  "version": "0.1.0",
  "description": "CLI tool for cleaning OpenClaw session transcripts",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "occ": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src tests",
    "format": "prettier --write src tests"
  },
  "keywords": ["openclaw", "context", "cli", "session"],
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.0",
    "vitest": "^2.0.0",
    "prettier": "^3.2.0",
    "eslint": "^9.0.0"
  },
  "dependencies": {
    "citty": "^0.1.6",
    "c12": "^2.0.0",
    "zod": "^3.22.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/types/**/*.ts"],
    },
  },
});
```

### 2. Create Error Classes

Create `src/errors.ts`:

```typescript
/**
 * Base error class for oc-context-cleaner.
 * All custom errors extend this for consistent handling.
 */
export class OccError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "OccError";
  }
}

/**
 * Thrown during skeleton phase to mark unimplemented code.
 * Should never appear in production—all stubs replaced before ship.
 */
export class NotImplementedError extends OccError {
  constructor(feature: string) {
    super(`Not implemented: ${feature}`, "NOT_IMPLEMENTED");
    this.name = "NotImplementedError";
  }
}

/**
 * Session not found by ID or partial match.
 * Resolution hint: "Use 'occ list' to see available sessions"
 */
export class SessionNotFoundError extends OccError {
  constructor(public readonly sessionId: string) {
    super(`Session '${sessionId}' not found`, "SESSION_NOT_FOUND");
    this.name = "SessionNotFoundError";
  }
}

/**
 * Partial session ID matches multiple sessions.
 * Includes list of matching session IDs for user to disambiguate.
 */
export class AmbiguousSessionError extends OccError {
  constructor(
    public readonly partial: string,
    public readonly matches: string[]
  ) {
    super(
      `Multiple sessions match '${partial}': ${matches.join(", ")}`,
      "AMBIGUOUS_SESSION"
    );
    this.name = "AmbiguousSessionError";
  }
}

/**
 * Edit operation failed (parse, write, or backup error).
 */
export class EditOperationError extends OccError {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message, "EDIT_FAILED");
    this.name = "EditOperationError";
  }
}

/**
 * Clone operation failed.
 */
export class CloneOperationError extends OccError {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message, "CLONE_FAILED");
    this.name = "CloneOperationError";
  }
}

/**
 * Restore operation failed (no backup or write error).
 */
export class RestoreError extends OccError {
  constructor(message: string) {
    super(message, "RESTORE_FAILED");
    this.name = "RestoreError";
  }
}

/**
 * No sessions found for agent.
 */
export class NoSessionsError extends OccError {
  constructor(public readonly agentId: string) {
    super(`No sessions found for agent '${agentId}'`, "NO_SESSIONS");
    this.name = "NoSessionsError";
  }
}

/**
 * Unknown preset name requested.
 */
export class UnknownPresetError extends OccError {
  constructor(public readonly presetName: string) {
    super(`Unknown preset: ${presetName}`, "UNKNOWN_PRESET");
    this.name = "UnknownPresetError";
  }
}

/**
 * Agent not found or cannot be determined.
 */
export class AgentNotFoundError extends OccError {
  constructor(
    message: string,
    public readonly availableAgents?: string[]
  ) {
    super(message, "AGENT_NOT_FOUND");
    this.name = "AgentNotFoundError";
  }
}
```

### 3. Create Session Types

Create `src/types/session-types.ts`:

```typescript
/**
 * OpenClaw session types.
 *
 * OpenClaw uses a different format than Claude Code:
 * - Tool calls: `{type: "toolCall"}` not `tool_use`
 * - Tool results: `{role: "toolResult"}` not content block
 * - Linear transcript (no parent/child UUID tree)
 * - Session header: separate `{type: "session"}` entry
 */

/**
 * OpenClaw session header entry (first line of JSONL).
 */
export interface SessionHeader {
  type: "session";
  version: string;
  id: string;
  timestamp: string;
  cwd: string;
}

/**
 * Content block within a message.
 */
export type ContentBlock = TextBlock | ToolCallBlock;

export interface TextBlock {
  type: "text";
  text: string;
}

/**
 * Tool call block in assistant message content.
 * Note: "toolCall" not "tool_use" (differs from Claude Code).
 */
export interface ToolCallBlock {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Message roles in OpenClaw.
 * Note: "toolResult" is a role, not a content block type.
 */
export type MessageRole = "user" | "assistant" | "toolResult";

/**
 * Usage information for assistant messages.
 */
export interface UsageInfo {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

/**
 * Conversation message structure.
 */
export interface ConversationMessage {
  role: MessageRole;
  content: ContentBlock[] | string;

  // Optional metadata (present on assistant messages)
  api?: string;
  provider?: string;
  model?: string;
  stopReason?: string;
  usage?: UsageInfo;

  // Present on toolResult messages
  toolCallId?: string;
}

/**
 * Message entry in session JSONL (non-header lines).
 */
export interface MessageEntry {
  type: "message";
  timestamp: number;
  message: ConversationMessage;
}

/**
 * Union type for all JSONL line items.
 */
export type SessionEntry = SessionHeader | MessageEntry;

/**
 * Parsed session with header separated from messages.
 */
export interface ParsedSession {
  header: SessionHeader;
  messages: MessageEntry[];
  filePath: string;
}

/**
 * Session index entry from sessions.json.
 */
export interface SessionIndexEntry {
  sessionId: string;
  updatedAt: number;
  sessionFile?: string;
  displayName?: string;
  label?: string;
}

/**
 * Sessions index structure (JSON object, not array).
 */
export interface SessionsIndex {
  [sessionKey: string]: SessionIndexEntry;
}
```

### 4. Create Operation Types

Create `src/types/operation-types.ts`:

```typescript
import type { ToolRemovalOptions } from "./tool-removal-types.js";

/**
 * Options for edit operation.
 */
export interface EditOptions {
  /** Session ID or path (if undefined, auto-detect current) */
  sessionId?: string;
  /** Agent ID (default: from config or "main") */
  agentId?: string;
  /** Tool removal configuration */
  toolRemoval?: ToolRemovalOptions;
  /** Output format */
  outputFormat: "human" | "json";
  /** Verbose output */
  verbose: boolean;
}

/**
 * Statistics for edit operations.
 */
export interface EditStatistics {
  messagesOriginal: number;
  messagesAfter: number;
  toolCallsOriginal: number;
  toolCallsRemoved: number;
  toolCallsTruncated: number;
  toolCallsPreserved: number;
  sizeOriginal: number;
  sizeAfter: number;
  reductionPercent: number;
}

/**
 * Result of edit operation.
 */
export interface EditResult {
  success: boolean;
  mode: "edit";
  sessionId: string;
  backupPath: string;
  statistics: EditStatistics;
}

/**
 * Options for clone operation.
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
 */
export interface CloneStatistics {
  messagesOriginal: number;
  messagesCloned: number;
  toolCallsOriginal: number;
  toolCallsRemoved: number;
  toolCallsTruncated: number;
  toolCallsPreserved: number;
  sizeOriginal: number;
  sizeCloned: number;
  reductionPercent: number;
}

/**
 * Result of clone operation.
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

/**
 * Options for list operation.
 */
export interface ListOptions {
  /** Agent ID (default: from config or "main") */
  agentId?: string;
  /** Limit number of results */
  limit?: number;
  /** Output format */
  outputFormat: "human" | "json";
}

/**
 * Options for info operation.
 */
export interface InfoOptions {
  /** Session ID */
  sessionId: string;
  /** Agent ID (default: from config or "main") */
  agentId?: string;
  /** Output format */
  outputFormat: "human" | "json";
}

/**
 * Session info statistics.
 */
export interface SessionInfo {
  sessionId: string;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  estimatedTokens: number;
  fileSizeBytes: number;
}

/**
 * Options for restore operation.
 */
export interface RestoreOptions {
  /** Session ID */
  sessionId: string;
  /** Agent ID (default: from config or "main") */
  agentId?: string;
}
```

### 5. Create Tool Removal Types

Create `src/types/tool-removal-types.ts`:

```typescript
import type { ContentBlock, MessageEntry, SessionEntry } from "./session-types.js";

/**
 * A turn represents one user input through the final assistant response.
 */
export interface TurnBoundary {
  startIndex: number;
  endIndex: number;
  turnIndex: number;
  hasToolCalls: boolean;
}

/**
 * Tool removal preset definition.
 */
export interface ToolRemovalPreset {
  name: string;
  /** How many turns-with-tools to keep (newest first) */
  keepTurnsWithTools: number;
  /** Percentage of kept turns to truncate (oldest portion, 0-100) */
  truncatePercent: number;
}

/**
 * Options for tool removal (may use preset name or override values).
 */
export interface ToolRemovalOptions {
  preset?: string;
  keepTurnsWithTools?: number;
  truncatePercent?: number;
}

/**
 * Resolved tool removal options (all values concrete).
 */
export interface ResolvedToolRemovalOptions {
  keepTurnsWithTools: number;
  truncatePercent: number;
}

/**
 * Statistics from tool removal.
 */
export interface ToolRemovalStatistics {
  turnsWithToolsTotal: number;
  turnsWithToolsRemoved: number;
  turnsWithToolsTruncated: number;
  turnsWithToolsPreserved: number;
  toolCallsRemoved: number;
  toolCallsTruncated: number;
}

/**
 * Result of tool removal operation.
 */
export interface ToolRemovalResult {
  processedEntries: SessionEntry[];
  statistics: ToolRemovalStatistics;
}

/**
 * Truncation constants.
 */
export const TRUNCATION_LIMITS = {
  maxChars: 120,
  maxLines: 2,
  argumentMarker: "...",
  contentMarker: "[truncated]",
} as const;

/**
 * Truncate a string to the specified limits.
 */
export function truncateString(
  text: string,
  maxChars: number = TRUNCATION_LIMITS.maxChars,
  maxLines: number = TRUNCATION_LIMITS.maxLines,
  marker: string = TRUNCATION_LIMITS.argumentMarker
): string {
  const lines = text.split("\n").slice(0, maxLines);
  let result = lines.join("\n");

  if (result.length > maxChars) {
    result = result.slice(0, maxChars - marker.length) + marker;
  } else if (text.split("\n").length > maxLines || text.length > result.length) {
    result = result + marker;
  }

  return result;
}

/**
 * Truncate tool call arguments for display.
 */
export function truncateArguments(args: Record<string, unknown>): string {
  const json = JSON.stringify(args);
  return truncateString(json, TRUNCATION_LIMITS.maxChars, TRUNCATION_LIMITS.maxLines, TRUNCATION_LIMITS.argumentMarker);
}

/**
 * Truncate tool result content for display.
 */
export function truncateToolResult(content: string | ContentBlock[]): string {
  let text: string;

  if (typeof content === "string") {
    text = content;
  } else {
    text = content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }

  return truncateString(text, TRUNCATION_LIMITS.maxChars, TRUNCATION_LIMITS.maxLines, TRUNCATION_LIMITS.contentMarker);
}
```

### 6. Create Configuration Types

Create `src/types/configuration-types.ts`:

```typescript
import type { ToolRemovalPreset } from "./tool-removal-types.js";

/**
 * User-provided configuration (partial, merged with defaults).
 */
export interface UserConfiguration {
  /** Override state directory (default: ~/.clawdbot) */
  stateDirectory?: string;
  /** Default agent ID (default: "main") */
  defaultAgentId?: string;
  /** Default preset name when --strip-tools has no value */
  defaultPreset?: string;
  /** Custom preset definitions */
  customPresets?: Record<string, ToolRemovalPreset>;
  /** Default output format */
  outputFormat?: "human" | "json";
  /** Enable verbose output by default */
  verboseOutput?: boolean;
}

/**
 * Fully resolved configuration (all values present).
 */
export interface ResolvedConfiguration {
  stateDirectory: string;
  defaultAgentId: string;
  defaultPreset: string;
  customPresets: Record<string, ToolRemovalPreset>;
  outputFormat: "human" | "json";
  verboseOutput: boolean;
}
```

### 7. Create Type Index

Create `src/types/index.ts`:

```typescript
// Session types
export type {
  SessionHeader,
  ContentBlock,
  TextBlock,
  ToolCallBlock,
  MessageRole,
  UsageInfo,
  ConversationMessage,
  MessageEntry,
  SessionEntry,
  ParsedSession,
  SessionIndexEntry,
  SessionsIndex,
} from "./session-types.js";

// Operation types
export type {
  EditOptions,
  EditStatistics,
  EditResult,
  CloneOptions,
  CloneStatistics,
  CloneResult,
  ListOptions,
  InfoOptions,
  SessionInfo,
  RestoreOptions,
} from "./operation-types.js";

// Tool removal types
export type {
  TurnBoundary,
  ToolRemovalPreset,
  ToolRemovalOptions,
  ResolvedToolRemovalOptions,
  ToolRemovalStatistics,
  ToolRemovalResult,
} from "./tool-removal-types.js";

export {
  TRUNCATION_LIMITS,
  truncateString,
  truncateArguments,
  truncateToolResult,
} from "./tool-removal-types.js";

// Configuration types
export type {
  UserConfiguration,
  ResolvedConfiguration,
} from "./configuration-types.js";
```

### 8. Create Test Fixtures

Create `tests/fixtures/sessions.ts`:

```typescript
import type {
  SessionHeader,
  SessionEntry,
  MessageEntry,
  ToolCallBlock,
  TextBlock,
} from "../../src/types/index.js";

export const FIXTURE_SESSION_HEADER: SessionHeader = {
  type: "session",
  version: "0.49.3",
  id: "test-session-001",
  timestamp: "2025-01-31T12:00:00.000Z",
  cwd: "/test/project",
};

export const FIXTURE_USER_MESSAGE: MessageEntry = {
  type: "message",
  timestamp: 1738324800000,
  message: {
    role: "user",
    content: [{ type: "text", text: "Hello" }],
  },
};

export const FIXTURE_ASSISTANT_WITH_TOOL: MessageEntry = {
  type: "message",
  timestamp: 1738324801000,
  message: {
    role: "assistant",
    content: [
      { type: "text", text: "Let me check that." },
      {
        type: "toolCall",
        id: "call_001",
        name: "Read",
        arguments: { file_path: "/test.txt" },
      },
    ],
    stopReason: "toolUse",
  },
};

export const FIXTURE_TOOL_RESULT: MessageEntry = {
  type: "message",
  timestamp: 1738324802000,
  message: {
    role: "toolResult",
    toolCallId: "call_001",
    content: [{ type: "text", text: "File contents here" }],
  },
};

export const FIXTURE_ASSISTANT_RESPONSE: MessageEntry = {
  type: "message",
  timestamp: 1738324803000,
  message: {
    role: "assistant",
    content: [{ type: "text", text: "Here is the file content." }],
    stopReason: "stop",
  },
};

/**
 * Create a session with N turns for testing.
 *
 * Each turn consists of:
 * 1. User message (text)
 * 2. Assistant message with tool calls (if toolsPerTurn > 0)
 * 3. Tool result messages (one per tool call)
 * 4. Final assistant response (text)
 */
export function createSessionWithTurns(
  turnCount: number,
  toolsPerTurn: number = 1
): SessionEntry[] {
  const entries: SessionEntry[] = [];
  let timestamp = 1738324800000;

  // Header
  entries.push({
    type: "session",
    version: "0.49.3",
    id: `test-session-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date(timestamp).toISOString(),
    cwd: "/test/project",
  });

  for (let turn = 0; turn < turnCount; turn++) {
    // User message
    entries.push({
      type: "message",
      timestamp: timestamp++,
      message: {
        role: "user",
        content: [{ type: "text", text: `User message for turn ${turn}` }],
      },
    });

    if (toolsPerTurn > 0) {
      // Assistant with tool calls
      const toolCalls: ToolCallBlock[] = [];
      for (let t = 0; t < toolsPerTurn; t++) {
        toolCalls.push({
          type: "toolCall",
          id: `call_${turn}_${t}`,
          name: "Read",
          arguments: { file_path: `/test/file_${turn}_${t}.txt` },
        });
      }

      const content: (TextBlock | ToolCallBlock)[] = [
        { type: "text", text: "Let me check." },
        ...toolCalls,
      ];

      entries.push({
        type: "message",
        timestamp: timestamp++,
        message: {
          role: "assistant",
          content,
          stopReason: "toolUse",
        },
      });

      // Tool results
      for (let t = 0; t < toolsPerTurn; t++) {
        entries.push({
          type: "message",
          timestamp: timestamp++,
          message: {
            role: "toolResult",
            toolCallId: `call_${turn}_${t}`,
            content: [
              { type: "text", text: `Result for tool call ${turn}_${t}` },
            ],
          },
        });
      }
    }

    // Final assistant response
    entries.push({
      type: "message",
      timestamp: timestamp++,
      message: {
        role: "assistant",
        content: [{ type: "text", text: `Response for turn ${turn}` }],
        stopReason: "stop",
      },
    });
  }

  return entries;
}

/**
 * Create a minimal session index for testing.
 */
export function createSessionIndex(
  sessionIds: string[]
): Record<string, { sessionId: string; updatedAt: number }> {
  const index: Record<string, { sessionId: string; updatedAt: number }> = {};
  let timestamp = Date.now();

  for (const id of sessionIds) {
    index[id] = {
      sessionId: id,
      updatedAt: timestamp--,
    };
  }

  return index;
}
```

## Constraints

- Do NOT create any runtime implementation code beyond types and fixtures
- Do NOT create test files yet (Story 1 handles algorithm tests)
- Use exact file paths as specified
- All imports must use `.js` extension for ESM compatibility

## Verification

After creating all files:

```bash
npm install
npm run typecheck
```

**Expected:** No errors. All types compile successfully.

## Done When

- [ ] `package.json` created with dependencies
- [ ] `tsconfig.json` configured for ESM
- [ ] `vitest.config.ts` configured
- [ ] `src/errors.ts` with all error classes
- [ ] `src/types/*.ts` with all type definitions
- [ ] `src/types/index.ts` re-exporting all types
- [ ] `tests/fixtures/sessions.ts` with test data generators
- [ ] `npm install` succeeds
- [ ] `npm run typecheck` passes with no errors
