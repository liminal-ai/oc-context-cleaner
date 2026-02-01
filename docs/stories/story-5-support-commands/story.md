# Story 5: Support Commands

## Overview

Implements the supporting commands: list, info, and restore. These enable session discovery, analysis, and recovery.

**After this story:** All session management commands work: `occ list`, `occ info <id>`, `occ restore <id>`.

## Prerequisites

- Stories 0-4 complete
- Edit and clone flows working
- `npm test` passes (42 tests)

## ACs Covered

- **AC-1.1:** List displays all sessions
- **AC-1.2:** Sessions sorted by recency
- **AC-1.3:** Entry displays required fields
- **AC-1.4:** `-n` limits output
- **AC-1.5:** `--json` outputs JSON array
- **AC-1.9:** Missing agent shows actionable error
- **AC-2.1:** Info displays statistics
- **AC-2.2:** Message counts accurate
- **AC-2.3:** Token estimation displayed
- **AC-2.4:** File size displayed
- **AC-2.5:** Info JSON complete
- **AC-2.6:** Error on invalid session
- **AC-2.7:** Empty session handled
- **AC-6.3:** Restore recovers from backup
- **AC-6.4:** Restore fails gracefully without backup

## Files

**New:**
- `src/commands/list-command.ts` — List sessions
- `src/commands/info-command.ts` — Session analysis
- `src/commands/restore-command.ts` — Backup recovery
- `src/output/list-formatter.ts` — Format session lists
- `src/output/info-formatter.ts` — Format statistics
- `tests/commands/list-command.test.ts`
- `tests/commands/info-command.test.ts`
- `tests/commands/restore-command.test.ts`

## Test Breakdown

- `list-command.test.ts`: 11 tests (TC-1.1a, TC-1.1b, TC-1.2a through TC-1.9a)
- `info-command.test.ts`: 8 tests (TC-2.1a, TC-2.1b, TC-2.2a through TC-2.7a)
- `restore-command.test.ts`: 3 tests (TC-6.3a, TC-6.3b, TC-6.4a)

- **Story total:** 22 tests
- **Running total:** 64 tests (42 prior + 22 new)

## Prompts

| Phase | File | Purpose |
|-------|------|---------|
| Skeleton + Red | prompt-5.1-skeleton-red.md | Stubs + tests |
| Green | prompt-5.2-green.md | Implementation |
| Verify | prompt-5.R-verify.md | Verification checklist |

## Exit Criteria

- All 22 new tests pass
- All previous tests still pass (64 total)
- List, info, restore commands work
- `npm run typecheck` passes
