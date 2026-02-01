# Story 4: Clone Flow

## Overview

Implements the clone command: create a new session from an existing one with optional tool stripping. This is the fallback mode when edit-in-place isn't desired or for archiving.

**After this story:** `occ clone <sessionId> --strip-tools` creates a new session file with a new UUID, optionally strips tools, and registers in the session index.

## Prerequisites

- Stories 0-3 complete
- Edit flow working
- `npm test` passes (31 tests: 12 algorithm + 19 edit)

**Note:** Story 2 (IO Layer) has 0 direct tests; IO modules are tested through command tests in Stories 3-5.

## ACs Covered

- **AC-4.1:** Clone creates new session with new UUID
- **AC-4.2:** Preserves non-tool content
- **AC-4.3:** Clone header contains metadata (clonedFrom, clonedAt)
- **AC-4.4:** Atomic operation (no partial files)
- **AC-4.5:** Custom output path (`-o`)
- **AC-4.6:** JSON output with resume command
- **AC-4.7:** Clone without stripping preserves all
- **AC-4.8:** Partial session ID matching
- **AC-4.9:** Updates session index
- **AC-4.10:** `--no-register` skips index update
- **AC-7.3:** JSON output complete

## Files

**New:**
- `src/core/clone-operation-executor.ts` — Clone orchestration
- `src/commands/clone-command.ts` — CLI command handler
- `tests/commands/clone-command.test.ts` — Clone command tests

**Modified:**
- `src/types/operation-types.ts` — Add `agentId` to `CloneOptions`
- `src/types/session-types.ts` — Add `ClonedSessionHeader` interface for clone metadata

## Test Breakdown

- `clone-command.test.ts`: 11 tests
  - TC-4.1a through TC-4.10a (10 tests)
  - TC-7.3a (1 test)

- **Story total:** 11 tests
- **Running total:** 42 tests (12 algorithm + 19 edit + 11 clone)

## Prompts

| Phase | File | Purpose |
|-------|------|---------|
| Skeleton + Red | prompt-4.1-skeleton-red.md | Stubs + tests |
| Green | prompt-4.2-green.md | Implementation |
| Verify | prompt-4.R-verify.md | Verification checklist |

**Note:** Skeleton and Red phases are combined into prompt 4.1 following the established pattern from previous stories. This reduces context-switching overhead for the implementing agent.

## Notes

**Index Registration Behavior (AC-4.9, AC-4.10):**
- Default: Clone updates session index with new entry
- `--no-register`: Skips index registration (for backup/export use)
- Custom `--output` path: Also skips index registration (custom paths are external to managed sessions)

This behavior is intentional per AC-4.10. Custom output paths represent exports/backups outside the managed session directory, so they should not pollute the session index.

**Tool Stripping (AC-5.x):**
Tool stripping uses the same `removeToolCalls` function tested in Story 1 (12 algorithm tests). Clone tests verify tool stripping is applied correctly via the executor; the core algorithm correctness is proven by the algorithm tests. Clone does not duplicate tool stripping tests.

**CLI Registration:**
The clone command CLI entry point registration is deferred to Story 6 (Configuration) when the main command aggregates all subcommands.

## Exit Criteria

- All 11 new tests pass
- All previous tests still pass (42 total: 12 algorithm + 19 edit + 11 clone)
- Clone command works end-to-end
- Session index updated correctly
- `npm run typecheck` passes
- `npm run lint` passes
