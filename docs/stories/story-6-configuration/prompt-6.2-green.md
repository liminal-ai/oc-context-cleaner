# Prompt 6.2: Configuration — Green

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Configuration loading and CLI entry point.

**Story 6:** Implement config loading and complete CLI.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Story 6 Skeleton+Red complete
- 7 config/main tests

## Task

Implement configuration loading and complete the CLI.

### 1. Implement Configuration Loader

Replace stubs in `src/config/configuration-loader.ts`:

**Important:** Use the `c12` library for config loading as specified in tech-design. c12 handles loading from multiple locations, merging configs, and environment variable overrides.

```typescript
import { loadConfig } from "c12";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ResolvedConfiguration, UserConfiguration } from "../types/index.js";
import { DEFAULT_CONFIGURATION } from "./default-configuration.js";
import { UserConfigurationSchema } from "./configuration-schema.js";

/**
 * Load configuration from all sources using c12.
 *
 * Priority (highest to lowest):
 * 1. CLI flags (not handled here)
 * 2. Environment variables
 * 3. Config file
 * 4. Defaults
 */
export async function loadConfiguration(): Promise<ResolvedConfiguration> {
  // Load from environment first (highest priority after CLI)
  const envConfig = loadFromEnvironment();

  // Use c12 to load config from standard locations
  const { config: fileConfig } = await loadConfig<UserConfiguration>({
    name: "occ",
    defaults: {},
    // c12 will check: occ.config.{js,ts,json}, .occrc, .occrc.json, package.json#occ
    rcFile: ".occrc",
    globalRc: true, // Check ~/.config/occ/ and ~/.occrc
  });

  // Validate file config if present
  let validatedFileConfig: UserConfiguration = {};
  if (fileConfig && Object.keys(fileConfig).length > 0) {
    const result = UserConfigurationSchema.safeParse(fileConfig);
    if (result.success) {
      validatedFileConfig = result.data;
    }
  }

  // Merge: defaults < file < environment
  const merged = mergeWithDefaults({
    ...validatedFileConfig,
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
 * Note: c12 handles most of this, but we expose paths for testing.
 */
export function getConfigPaths(): string[] {
  const home = homedir();
  return [
    // XDG config (c12 globalRc checks this)
    join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "occ", "config.json"),
    // Home directory rc files
    join(home, ".occrc.json"),
    join(home, ".occrc"),
    // Current directory (c12 checks these by default)
    join(process.cwd(), ".occrc.json"),
    join(process.cwd(), "occ.config.json"),
    join(process.cwd(), "occ.config.ts"),
    join(process.cwd(), "occ.config.js"),
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

**Important:** Import `DEFAULT_STATE_DIR` and `DEFAULT_AGENT_ID` from `paths.ts`. Do NOT redefine them here to avoid duplication.

```typescript
import type { ResolvedConfiguration } from "../types/index.js";
import { DEFAULT_STATE_DIR, DEFAULT_AGENT_ID } from "../io/paths.js";

export const DEFAULT_CONFIGURATION: ResolvedConfiguration = {
  stateDirectory: DEFAULT_STATE_DIR,
  defaultAgentId: DEFAULT_AGENT_ID,
  defaultPreset: "default",
  customPresets: {},
  outputFormat: "human",
  verboseOutput: false,
};
```

### 5. Wire Config into CLI Entry Point

Update `src/cli.ts` to load config at startup and make it available to commands:

```typescript
#!/usr/bin/env node
import { runMain } from "citty";
import { mainCommand } from "./commands/main-command.js";
import { loadConfiguration } from "./config/configuration-loader.js";
import type { ResolvedConfiguration } from "./types/index.js";

// Global config instance (loaded once at startup)
let resolvedConfig: ResolvedConfiguration | null = null;

/**
 * Get the resolved configuration.
 * Lazy-loads on first access.
 */
export async function getConfig(): Promise<ResolvedConfiguration> {
  if (!resolvedConfig) {
    resolvedConfig = await loadConfiguration();
  }
  return resolvedConfig;
}

// Run the CLI
runMain(mainCommand);
```

**Note:** Commands access config via `getConfig()` when needed. CLI flags override config values at the command level (precedence: CLI flags > env vars > config file > defaults).

### 6. Config-Command Integration Pattern

When commands need config values, they should:

1. Call `getConfig()` to get resolved configuration
2. Check CLI flags first (highest priority)
3. Fall back to config values

Example pattern in a command:
```typescript
// In edit-command.ts run handler:
const config = await getConfig();
const preset = args.preset || config.defaultPreset;
const outputFormat = args.json ? "json" : config.outputFormat;
const verbose = args.verbose || config.verboseOutput;
```

**Note:** `src/io/paths.ts` already exists with `DEFAULT_STATE_DIR` and `DEFAULT_AGENT_ID`. Do NOT modify it or duplicate those constants.

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
- All 71 tests pass

## Done When

- [ ] `src/config/configuration-loader.ts` fully implemented with c12
- [ ] `src/config/default-configuration.ts` imports from paths.ts (no duplicate constants)
- [ ] `src/commands/main-command.ts` fully implemented
- [ ] `src/cli.ts` ready to run with config loading
- [ ] Config loading works (file via c12, env, defaults)
- [ ] Config precedence correct: CLI flags > env vars > config file > defaults
- [ ] Quickstart displays correctly
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (71 tests)
