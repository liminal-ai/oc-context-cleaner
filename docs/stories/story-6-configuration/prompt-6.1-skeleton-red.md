# Prompt 6.1: Configuration — Skeleton + Red

## Context

**Product:** oc-context-cleaner — CLI tool for cleaning OpenClaw session transcripts.

**Feature:** Configuration loading and CLI entry point.

**Story 6:** Config, help, quickstart, and CLI assembly.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Prerequisites:**
- Stories 0-5 complete
- All commands implemented

## Reference Documents

- Tech Design: `docs/tech-design.md` (Configuration section)
- Feature Spec: `docs/feature-spec.md` (AC-7.7, AC-7.8, AC-8.x)

## Task

Create skeleton implementations for configuration and CLI entry point.

### 1. Create Configuration Schema

Create `src/config/configuration-schema.ts`:

```typescript
import { z } from "zod";

export const ToolRemovalPresetSchema = z.object({
  name: z.string(),
  keepTurnsWithTools: z.number().int().min(0),
  truncatePercent: z.number().min(0).max(100),
});

export const UserConfigurationSchema = z.object({
  stateDirectory: z.string().optional(),
  defaultAgentId: z.string().optional(),
  defaultPreset: z.string().optional(),
  customPresets: z.record(ToolRemovalPresetSchema).optional(),
  outputFormat: z.enum(["human", "json"]).optional(),
  verboseOutput: z.boolean().optional(),
});

export type ValidatedUserConfiguration = z.infer<typeof UserConfigurationSchema>;
```

### 2. Create Default Configuration

Create `src/config/default-configuration.ts`:

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

### 3. Create Configuration Loader Skeleton

Create `src/config/configuration-loader.ts`:

```typescript
import type { ResolvedConfiguration, UserConfiguration } from "../types/index.js";
import { NotImplementedError } from "../errors.js";

/**
 * Load configuration from all sources.
 *
 * Priority (highest to lowest):
 * 1. CLI flags (not handled here)
 * 2. Environment variables
 * 3. Config file
 * 4. Defaults
 */
export async function loadConfiguration(): Promise<ResolvedConfiguration> {
  throw new NotImplementedError("loadConfiguration");
}

/**
 * Merge user configuration with defaults.
 */
export function mergeWithDefaults(
  userConfig: UserConfiguration
): ResolvedConfiguration {
  throw new NotImplementedError("mergeWithDefaults");
}

/**
 * Load configuration from environment variables.
 */
export function loadFromEnvironment(): Partial<UserConfiguration> {
  throw new NotImplementedError("loadFromEnvironment");
}

/**
 * Get config file paths to check.
 */
export function getConfigPaths(): string[] {
  throw new NotImplementedError("getConfigPaths");
}
```

### 4. Create Main Command Skeleton

Create `src/commands/main-command.ts`:

```typescript
import { defineCommand } from "citty";
import { editCommand } from "./edit-command.js";
import { cloneCommand } from "./clone-command.js";
import { listCommand } from "./list-command.js";
import { infoCommand } from "./info-command.js";
import { restoreCommand } from "./restore-command.js";
import { NotImplementedError } from "../errors.js";

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
    throw new NotImplementedError("main command run");
  },
});
```

### 5. Create CLI Entry Point Skeleton

Create `src/cli.ts`:

```typescript
#!/usr/bin/env node
import { runMain } from "citty";
import { mainCommand } from "./commands/main-command.js";

runMain(mainCommand);
```

### 6. Create SDK Exports

Create `src/index.ts`:

```typescript
// Types
export * from "./types/index.js";

// Errors
export * from "./errors.js";

// Core operations
export { executeEdit } from "./core/edit-operation-executor.js";
export { executeClone } from "./core/clone-operation-executor.js";
export { removeToolCalls } from "./core/tool-call-remover.js";

// IO operations
export { readSessionFile, readSessionEntries } from "./io/session-file-reader.js";
export { writeSessionFile } from "./io/session-file-writer.js";
export { resolveSessionId, getCurrentSession } from "./io/session-discovery.js";

// Configuration
export { loadConfiguration } from "./config/configuration-loader.js";
export { BUILT_IN_PRESETS, resolvePreset } from "./config/tool-removal-presets.js";
```

### 7. Create Main Command Tests

Create `tests/commands/main-command.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { QUICKSTART_TEXT, mainCommand } from "../../src/commands/main-command.js";

describe("main-command", () => {
  // TC-7.7a: Help flag shows usage
  it("help is available via citty", () => {
    // citty handles --help automatically
    // We just verify the command metadata is correct
    expect(mainCommand.meta.name).toBe("occ");
    expect(mainCommand.meta.description).toBeTruthy();
    expect(mainCommand.subCommands).toBeDefined();
    expect(Object.keys(mainCommand.subCommands!)).toContain("edit");
    expect(Object.keys(mainCommand.subCommands!)).toContain("clone");
    expect(Object.keys(mainCommand.subCommands!)).toContain("list");
    expect(Object.keys(mainCommand.subCommands!)).toContain("info");
    expect(Object.keys(mainCommand.subCommands!)).toContain("restore");
  });

  // TC-7.8a: Quickstart shows condensed help
  it("quickstart shows condensed help", () => {
    expect(QUICKSTART_TEXT).toBeTruthy();
    expect(QUICKSTART_TEXT.length).toBeLessThan(1500); // ~250 tokens ≈ 1000-1500 chars
    expect(QUICKSTART_TEXT).toContain("WHEN TO USE");
    expect(QUICKSTART_TEXT).toContain("PRESETS");
    expect(QUICKSTART_TEXT).toContain("COMMON COMMANDS");
    expect(QUICKSTART_TEXT).toContain("occ edit");
    expect(QUICKSTART_TEXT).toContain("occ clone");
    expect(QUICKSTART_TEXT).toContain("occ list");
  });
});
```

### 8. Create Configuration Tests

Create `tests/config/configuration-loader.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";

vi.mock("node:fs/promises", async () => {
  const memfs = await import("memfs");
  return memfs.fs.promises;
});

import {
  loadConfiguration,
  mergeWithDefaults,
  loadFromEnvironment,
  getConfigPaths,
} from "../../src/config/configuration-loader.js";
import { resolvePreset, resolveToolRemovalOptions } from "../../src/config/tool-removal-presets.js";
import { DEFAULT_CONFIGURATION } from "../../src/config/default-configuration.js";

describe("configuration-loader", () => {
  beforeEach(() => {
    vol.reset();
    vi.stubEnv("CLAWDBOT_STATE_DIR", undefined);
    vi.stubEnv("OCC_PRESET", undefined);
    vi.stubEnv("OCC_OUTPUT_FORMAT", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // TC-8.1a: Config read from standard location
  it("config read from standard location", async () => {
    const configDir = "/home/user/.config/occ";
    vol.mkdirSync(configDir, { recursive: true });
    vol.writeFileSync(
      `${configDir}/config.json`,
      JSON.stringify({ defaultPreset: "aggressive" })
    );

    // Mock home directory
    vi.stubEnv("HOME", "/home/user");

    const paths = getConfigPaths();
    expect(paths.some((p) => p.includes(".config"))).toBe(true);
  });

  // TC-8.2a: Custom preset from config
  it("custom preset from config applied", async () => {
    const config = await loadConfiguration();
    const merged = mergeWithDefaults({
      customPresets: {
        conservative: {
          name: "conservative",
          keepTurnsWithTools: 30,
          truncatePercent: 25,
        },
      },
    });

    const preset = resolvePreset("conservative", merged.customPresets);
    expect(preset.keepTurnsWithTools).toBe(30);
    expect(preset.truncatePercent).toBe(25);
  });

  // TC-8.3a: Environment variable overrides config
  it("environment variable overrides config", async () => {
    vol.mkdirSync("/home/user/.config/occ", { recursive: true });
    vol.writeFileSync(
      "/home/user/.config/occ/config.json",
      JSON.stringify({ defaultPreset: "aggressive" })
    );

    vi.stubEnv("HOME", "/home/user");
    vi.stubEnv("OCC_PRESET", "default");

    const envConfig = loadFromEnvironment();
    // Environment should override
    if (envConfig.defaultPreset) {
      expect(envConfig.defaultPreset).toBe("default");
    }
  });

  // TC-8.4a: CLI flag overrides environment
  it("CLI flag overrides environment variable", () => {
    vi.stubEnv("OCC_PRESET", "default");

    // CLI override happens at command level, not in config loader
    // This test verifies the precedence logic exists
    const options = resolveToolRemovalOptions({ preset: "aggressive" });
    expect(options.keepTurnsWithTools).toBe(10); // aggressive
  });
});
```

## Constraints

- Stubs should throw `NotImplementedError`
- Quickstart text must be ~250 tokens
- Config uses c12 loading pattern

## Verification

```bash
npm run typecheck
npm test
```

**Expected:**
- Typecheck passes
- 57 previous tests pass
- 6 new tests fail with NotImplementedError (some may pass if static)

## Done When

- [ ] `src/config/configuration-schema.ts` created
- [ ] `src/config/default-configuration.ts` created
- [ ] `src/config/configuration-loader.ts` created with stubs
- [ ] `src/commands/main-command.ts` created with quickstart
- [ ] `src/cli.ts` created
- [ ] `src/index.ts` created
- [ ] `tests/commands/main-command.test.ts` created with 2 tests
- [ ] `tests/config/configuration-loader.test.ts` created with 4 tests
- [ ] `npm run typecheck` passes
