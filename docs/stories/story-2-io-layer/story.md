# Story 2: IO Layer

## Overview

Implements filesystem operations: reading/writing session files, session discovery, and path resolution. These modules bridge the core algorithm to the filesystem.

**After this story:** The system can read OpenClaw session files, write modified sessions atomically, and discover sessions by ID (full, partial, or auto-detect).

## Prerequisites

- Story 0 complete (types, fixtures)
- Story 1 complete (core algorithm)
- `npm test` passes (12 tests)

## ACs Covered

- **AC-1.6:** Partial session ID matching supported
- **AC-1.7:** Auto-detect active agent from environment
- **AC-1.8:** `--agent` flag overrides auto-detection
- **AC-1.9:** Missing agent context shows actionable error
- **AC-3.6:** Partial session ID matching for edit
- **AC-3.8:** Auto-detect current session for edit
- **AC-4.8:** Partial session ID matching for clone

## Files

**New:**
- `src/io/paths.ts` — Path resolution utilities
- `src/io/session-file-reader.ts` — Read and parse session files
- `src/io/session-file-writer.ts` — Atomic write operations
- `src/io/session-index-reader.ts` — Read sessions.json
- `src/io/session-index-writer.ts` — Update sessions.json
- `src/io/session-discovery.ts` — Find sessions, resolve IDs

## Test Breakdown

- IO layer is tested through command tests in Stories 3-5
- No separate IO tests (avoid testing internal modules)

**TCs implemented (tested in later stories):**
- TC-1.6a, TC-1.6b: Partial ID matching (Story 3, 4)
- TC-1.7a: Agent auto-detection (Story 3)
- TC-1.8a: Agent flag override (Story 3)
- TC-1.9a: Missing agent error (Story 3)
- TC-3.6a: Partial ID for edit (Story 3)
- TC-3.8a, TC-3.8b: Auto-detect for edit (Story 3)
- TC-4.8a: Partial ID for clone (Story 4)

- **Story total:** 0 tests (coverage via command tests)
- **Running total:** 12 tests

## Prompts

| Phase | File | Purpose |
|-------|------|---------|
| Skeleton + Red | prompt-2.1-skeleton-red.md | IO stubs |
| Green | prompt-2.2-green.md | Implementation |
| Verify | prompt-2.R-verify.md | Verification checklist |

## Exit Criteria

- All IO modules compile
- Can read real OpenClaw session files
- Can write files atomically
- Session discovery works (partial ID, auto-detect)
- `npm run typecheck` passes
