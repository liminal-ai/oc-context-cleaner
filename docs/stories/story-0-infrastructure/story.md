# Story 0: Infrastructure

## Overview

Sets up the foundational scaffolding before feature implementation begins. All types compile, all stubs throw `NotImplementedError`. No runtime behavior yet—this is pure structure.

**After this story:** The codebase has a complete type system, error hierarchy, and test fixtures. Subsequent stories implement against these contracts.

## Prerequisites

- Node.js 18+ installed
- Project initialized with `npm init`
- TypeScript configured

## ACs Covered

None directly—this is infrastructure supporting all ACs.

## Files

**New:**
- `src/errors.ts` — Error class hierarchy
- `src/types/index.ts` — Type re-exports
- `src/types/session-types.ts` — OpenClaw session/message types
- `src/types/operation-types.ts` — Edit/clone operation types
- `src/types/tool-removal-types.ts` — Tool removal algorithm types
- `src/types/configuration-types.ts` — Config types
- `tests/fixtures/sessions.ts` — Test data generators
- `package.json` — Dependencies
- `tsconfig.json` — TypeScript config
- `vitest.config.ts` — Test config

## Test Breakdown

- No tests in this story (types only)
- **Story total:** 0 tests
- **Running total:** 0 tests

## Prompts

| Phase | File | Purpose |
|-------|------|---------|
| Setup | prompt-0.1-setup.md | Create all infrastructure files |
| Verify | prompt-0.R-verify.md | Verify types compile |

## Exit Criteria

- `npm run typecheck` passes
- All type files export correctly
- Error classes defined
- Test fixtures available
