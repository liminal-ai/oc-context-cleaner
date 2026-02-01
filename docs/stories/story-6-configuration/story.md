# Story 6: Configuration

## Overview

Implements configuration loading, custom presets, and the main CLI entry point with help/quickstart output. This completes the CLI tool.

**After this story:** The complete `occ` CLI is functional with config file support, custom presets, and comprehensive help.

## Prerequisites

- Stories 0-5 complete
- All commands implemented
- `npm test` passes (57 tests)

## ACs Covered

- **AC-7.7:** `--help` displays usage information
- **AC-7.8:** `--quickstart` displays condensed agent-friendly help
- **AC-8.1:** Config read from standard locations
- **AC-8.2:** Custom presets from config
- **AC-8.3:** Environment variables override config
- **AC-8.4:** CLI flags override environment variables

## Files

**New:**
- `src/config/configuration-schema.ts` — Zod validation schemas
- `src/config/configuration-loader.ts` — c12-based config loading
- `src/config/default-configuration.ts` — Default values
- `src/commands/main-command.ts` — Root command with subcommands
- `src/cli.ts` — CLI entry point
- `src/index.ts` — SDK exports
- `tests/commands/main-command.test.ts` — Help/quickstart tests
- `tests/config/configuration-loader.test.ts` — Config tests

## Test Breakdown

- `main-command.test.ts`: 2 tests (TC-7.7a, TC-7.8a)
- `configuration-loader.test.ts`: 4 tests (TC-8.1a through TC-8.4a)

- **Story total:** 6 tests
- **Running total:** 63 tests

## Prompts

| Phase | File | Purpose |
|-------|------|---------|
| Skeleton + Red | prompt-6.1-skeleton-red.md | Stubs + tests |
| Green | prompt-6.2-green.md | Implementation |
| Verify | prompt-6.R-verify.md | Verification checklist |

## Exit Criteria

- All 6 new tests pass
- All previous tests still pass (63 total)
- CLI entry point works
- Config loading works
- Help and quickstart display correctly
- `npm run typecheck` passes
