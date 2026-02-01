# Story 3: Edit Flow

## Overview

Implements the complete edit command: backup creation, tool stripping, and atomic write-back. This is the primary use case—agents edit their own sessions in place.

**After this story:** `occ edit <sessionId> --strip-tools` works end-to-end. Backups are created, tool calls stripped, and sessions modified in place.

## Prerequisites

- Story 0 complete (types, fixtures)
- Story 1 complete (core algorithm)
- Story 2 complete (IO layer)
- `npm test` passes (12 tests)

## ACs Covered

- **AC-3.1:** Edit modifies session in place
- **AC-3.2:** Backup created before modifying
- **AC-3.3:** Preserves non-tool content
- **AC-3.4:** Atomic operation (original unchanged on failure)
- **AC-3.5:** JSON output with statistics
- **AC-3.6:** Partial session ID matching
- **AC-3.7:** Session remains resumable
- **AC-3.8:** Auto-detect current session
- **AC-6.1:** Backup created on edit
- **AC-6.2:** Monotonic backup numbering
- **AC-6.5:** Backup rotation (max 5)
- **AC-7.1:** Human-readable default output
- **AC-7.2:** Output includes required fields
- **AC-7.4:** Verbose shows detailed stats
- **AC-7.5:** Exit codes (0 success, non-zero failure)
- **AC-7.6:** Actionable error messages

## Files

**New:**
- `src/core/backup-manager.ts` — Backup create/rotate/restore
- `src/core/edit-operation-executor.ts` — Edit orchestration
- `src/commands/edit-command.ts` — CLI command handler
- `src/output/result-formatter.ts` — Format operation results
- `src/config/tool-removal-presets.ts` — Preset configurations for tool removal
- `tests/commands/edit-command.test.ts` — Edit command tests

## Test Breakdown

- `edit-command.test.ts`: 19 tests
  - TC-3.1a through TC-3.8b (9 tests: 3.1a, 3.2a, 3.3a, 3.4a, 3.5a, 3.6a, 3.7a, 3.8a, 3.8b)
  - TC-6.1a, TC-6.2a, TC-6.5a, TC-6.5b (4 tests)
  - TC-7.1a, TC-7.2a, TC-7.4a, TC-7.5a, TC-7.5b, TC-7.6a (6 tests)

- **Story total:** 19 tests
- **Running total:** 31 tests (12 algorithm + 19 edit)

## Prompts

| Phase | File | Purpose |
|-------|------|---------|
| Skeleton + Red | prompt-3.1-skeleton-red.md | Stubs + tests |
| Green | prompt-3.2-green.md | Implementation |
| Verify | prompt-3.R-verify.md | Verification checklist |

## Exit Criteria

- All 19 new tests pass
- All previous 12 tests still pass (31 total)
- Edit command works end-to-end
- Backup rotation works correctly
- `npm run typecheck` passes
