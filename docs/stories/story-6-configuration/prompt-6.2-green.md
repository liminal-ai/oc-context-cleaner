# Prompt 6.2: Configuration — Green

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Configuration loading and CLI entry point.

**Story 6:** Implement config loading and complete CLI.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Story 6 Skeleton+Red complete
- 6 config/main tests

## Task

Implement configuration loading and complete the CLI.

### 1. Implement Configuration Loader

Replace stubs in `src/config/configuration-loader.ts`:

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ResolvedConfiguration, UserConfiguration } from "../types/index.js";
import { DEFAULT_CONFIGURATION } from "./default-configuration.js";
import { UserConfigurationSchema } from "./configuration-schema.js";

/**
 * Load configuration from all sources.
 */
export async function loadConfiguration(): Promise<ResolvedConfiguration> {
  // Load from environment first
  const envConfig = loadFromEnvironment();

  // Try to load from config file
  let fileConfig: UserConfiguration = {};
  const configPaths = getConfigPaths();

  for (const configPath of configPaths) {
    try {
      const content = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(content);
      const validated = UserConfigurationSchema.parse(parsed);
      fileConfig = validated;
      break; // Use first found config
    } catch {
      // Config file not found or invalid, continue
    }
  }

  // Merge: defaults < file < environment
  const merged = mergeWithDefaults({
    ...fileConfig,
    ...envConfig,
  });

  return merged;
}

/**
 * Merge user configuration with defaults.
 */
export function mergeWithDefaults(
  userConfig: UserConfiguration
): ResolvedConfiguration {
  return {
    stateDirectory: userConfig.stateDirectory ?? DEFAULT_CONFIGURATION.stateDirectory,
    defaultAgentId: userConfig.defaultAgentId ?? DEFAULT_CONFIGURATION.defaultAgentId,
    defaultPreset: userConfig.defaultPreset ?? DEFAULT_CONFIGURATION.defaultPreset,
    customPresets: {
      ...DEFAULT_CONFIGURATION.customPresets,
      ...userConfig.customPresets,
    },
    outputFormat: userConfig.outputFormat ?? DEFAULT_CONFIGURATION.outputFormat,
    verboseOutput: userConfig.verboseOutput ?? DEFAULT_CONFIGURATION.verboseOutput,
  };
}

/**
 * Load configuration from environment variables.
 */
export function loadFromEnvironment(): Partial<UserConfiguration> {
  const config: Partial<UserConfiguration> = {};

  if (process.env.CLAWDBOT_STATE_DIR) {
    config.stateDirectory = process.env.CLAWDBOT_STATE_DIR;
  }

  if (process.env.CLAWDBOT_AGENT_ID) {
    config.defaultAgentId = process.env.CLAWDBOT_AGENT_ID;
  }

  if (process.env.OCC_PRESET) {
    config.defaultPreset = process.env.OCC_PRESET;
  }

  if (process.env.OCC_OUTPUT_FORMAT) {
    const format = process.env.OCC_OUTPUT_FORMAT;
    if (format === "json" || format === "human") {
      config.outputFormat = format;
    }
  }

  if (process.env.OCC_VERBOSE) {
    config.verboseOutput = process.env.OCC_VERBOSE === "true" || process.env.OCC_VERBOSE === "1";
  }

  return config;
}

/**
 * Get config file paths to check.
 */
export function getConfigPaths(): string[] {
  const home = homedir();
  return [
    // XDG config
    join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "occ", "config.json"),
    // Home directory
    join(home, ".occrc.json"),
    join(home, ".occ.json"),
    // Current directory
    join(process.cwd(), ".occrc.json"),
    join(process.cwd(), "occ.config.json"),
  ];
}
```

### 2. Implement Main Command

Replace stubs in `src/commands/main-command.ts`:

```typescript
import { defineCommand } from "citty";
import { editCommand } from "./edit-command.js";
import { cloneCommand } from "./clone-command.js";
import { listCommand } from "./list-command.js";
import { infoCommand } from "./info-command.js";
import { restoreCommand } from "./restore-command.js";

/**
 * Quickstart help text (~250 tokens).
 */
export const QUICKSTART_TEXT = `
occ - OpenClaw Context Cleaner

WHEN TO USE:
  Running low on context? Clean up old tool calls to keep working.

PRESETS:
  default     Keep 20 recent turns with tools, truncate half
  aggressive  Keep 10 recent turns, truncate half
  extreme     Remove all tool calls

COMMON COMMANDS:
  occ edit --strip-tools           Edit current session (auto-detect)
  occ edit abc123 --strip-tools    Edit specific session
  occ clone <id> --strip-tools     Clone instead of edit
  occ list                         Show available sessions
  occ info <id>                    Analyze session before cleaning
  occ restore <id>                 Undo last edit from backup

FLAGS:
  --json       Machine-readable output
  --verbose    Detailed statistics
  --help       Full documentation
`.trim();

export const mainCommand = defineCommand({
  meta: {
    name: "occ",
    description: "OpenClaw Context Cleaner - Clean session transcripts",
    version: "0.1.0",
  },
  args: {
    quickstart: {
      type: "boolean",
      description: "Show condensed agent-friendly help",
      default: false,
    },
  },
  subCommands: {
    edit: editCommand,
    clone: cloneCommand,
    list: listCommand,
    info: infoCommand,
    restore: restoreCommand,
  },
  async run({ args }) {
    if (args.quickstart) {
      console.log(QUICKSTART_TEXT);
      return;
    }

    // Default behavior: show help hint
    console.log("occ - OpenClaw Context Cleaner");
    console.log("");
    console.log("Usage: occ <command> [options]");
    console.log("");
    console.log("Commands:");
    console.log("  edit     Edit a session in place");
    console.log("  clone    Clone a session to a new file");
    console.log("  list     List available sessions");
    console.log("  info     Show session statistics");
    console.log("  restore  Restore session from backup");
    console.log("");
    console.log("Use 'occ --help' for full documentation");
    console.log("Use 'occ --quickstart' for agent-friendly quick reference");
  },
});
```

### 3. Update CLI Entry Point

Update `src/cli.ts`:

```typescript
#!/usr/bin/env node
import { runMain } from "citty";
import { mainCommand } from "./commands/main-command.js";

runMain(mainCommand);
```

### 4. Ensure Default Configuration Exports

Update `src/config/default-configuration.ts`:

```typescript
import type { ResolvedConfiguration } from "../types/index.js";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_STATE_DIR = join(homedir(), ".clawdbot");
export const DEFAULT_AGENT_ID = "main";

export const DEFAULT_CONFIGURATION: ResolvedConfiguration = {
  stateDirectory: DEFAULT_STATE_DIR,
  defaultAgentId: DEFAULT_AGENT_ID,
  defaultPreset: "default",
  customPresets: {},
  outputFormat: "human",
  verboseOutput: false,
};
```

### 5. Update Paths to Use Config

Update `src/io/paths.ts` to use defaults from config:

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

## Constraints

- Config loading should not fail if no config file exists
- Environment variables take precedence over file config
- Quickstart must stay under ~250 tokens

## Verification

```bash
npm run typecheck
npm test
```

**Expected:**
- Typecheck passes
- All 63 tests pass

## Done When

- [ ] `src/config/configuration-loader.ts` fully implemented
- [ ] `src/commands/main-command.ts` fully implemented
- [ ] `src/cli.ts` ready to run
- [ ] Config loading works (file, env, defaults)
- [ ] Quickstart displays correctly
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (63 tests)
