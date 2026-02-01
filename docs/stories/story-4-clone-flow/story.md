# Story 4: Clone Flow

## Overview

Implements the clone command: create a new session from an existing one with optional tool stripping. This is the fallback mode when edit-in-place isn't desired or for archiving.

**After this story:** `occ clone <sessionId> --strip-tools` creates a new session file with a new UUID, optionally strips tools, and registers in the session index.

## Prerequisites

- Stories 0-3 complete
- Edit flow working
- `npm test` passes (27 tests)

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

## Test Breakdown

- `clone-command.test.ts`: 11 tests
  - TC-4.1a through TC-4.10a (10 tests)
  - TC-7.3a (1 test)

- **Story total:** 11 tests
- **Running total:** 38 tests

## Prompts

| Phase | File | Purpose |
|-------|------|---------|
| Skeleton + Red | prompt-4.1-skeleton-red.md | Stubs + tests |
| Green | prompt-4.2-green.md | Implementation |
| Verify | prompt-4.R-verify.md | Verification checklist |

## Exit Criteria

- All 11 new tests pass
- All previous tests still pass (38 total)
- Clone command works end-to-end
- Session index updated correctly
- `npm run typecheck` passes
