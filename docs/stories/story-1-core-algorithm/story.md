# Story 1: Core Algorithm

## Overview

Implements the heart of the cleaner: turn boundary detection and tool call removal. Pure functions with no I/O dependencies—these operate on in-memory data structures.

**After this story:** The tool removal algorithm works on fixture data. Given session entries and a preset, it correctly identifies turns, classifies them, and removes/truncates tool calls.

## Prerequisites

- Story 0 complete (types, fixtures, error classes)
- `npm run typecheck` passes

## ACs Covered

- **AC-5.1:** Default preset keeps last 20 turns-with-tools, truncates oldest 50%
- **AC-5.2:** Aggressive preset keeps last 10 turns-with-tools
- **AC-5.3:** Extreme preset removes all tool calls
- **AC-5.4:** No dangling tool references after stripping
- **AC-5.5:** Most recent turns-with-tools preserved at full fidelity
- **AC-5.6:** Truncation reduces to 2 lines or 120 characters
- **AC-5.7:** Removed tool calls deleted entirely
- **AC-5.8:** Sessions without tools process without modification

## Files

**New:**
- `src/core/turn-boundary-calculator.ts` — Identify turn boundaries
- `src/core/tool-call-remover.ts` — Tool stripping algorithm
- `src/core/session-parser.ts` — JSONL parsing utilities
- `tests/algorithms/tool-call-remover.test.ts` — Algorithm tests

## Test Breakdown

- `tool-call-remover.test.ts`: 8 tests
  - TC-5.1a: Default keeps 20 turns with tools
  - TC-5.1b: Default truncates oldest 50% of kept
  - TC-5.2a: Aggressive keeps 10 turns
  - TC-5.3a: Extreme removes all tool calls
  - TC-5.4a: No dangling tool references
  - TC-5.6a: Truncation respects limits
  - TC-5.7a: Removed tool calls deleted entirely
  - TC-5.8a: No-tool session unchanged

- **Story total:** 8 tests
- **Running total:** 8 tests

## Prompts

| Phase | File | Purpose |
|-------|------|---------|
| Skeleton + Red | prompt-1.1-skeleton-red.md | Stubs + failing tests |
| Green | prompt-1.2-green.md | Implementation |
| Verify | prompt-1.R-verify.md | Verification checklist |

## Exit Criteria

- All 8 tests pass
- `npm run typecheck` passes
- Tool removal algorithm handles all preset configurations
- No dangling tool references in output
