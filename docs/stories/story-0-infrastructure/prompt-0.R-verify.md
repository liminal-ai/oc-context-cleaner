# Prompt 0.R: Infrastructure Verification

## Context

**Story 0** created the foundational infrastructure for oc-context-cleaner. This verification ensures all types compile correctly and the project is ready for Story 1.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Role:** You are a verifier. Check that the infrastructure meets requirements. Do not implement new features.

## Verification Checklist

### 1. Project Structure

Verify these files exist:

```
src/
├── errors.ts
└── types/
    ├── index.ts
    ├── session-types.ts
    ├── operation-types.ts
    ├── tool-removal-types.ts
    └── configuration-types.ts

tests/
└── fixtures/
    └── sessions.ts

package.json
tsconfig.json
vitest.config.ts
biome.json
```

### 2. TypeScript Compilation

```bash
npm run typecheck
```

**Expected:** Exit code 0, no errors.

### 3. Error Classes

Verify `src/errors.ts` exports:
- `OccError` (base class)
- `NotImplementedError`
- `SessionNotFoundError`
- `AmbiguousSessionError`
- `EditOperationError`
- `CloneOperationError`
- `RestoreError`
- `NoSessionsError`
- `UnknownPresetError`
- `AgentNotFoundError`

### 4. Session Types

Verify `src/types/session-types.ts` exports:
- `SessionHeader`
- `ContentBlock`, `TextBlock`, `ToolCallBlock`
- `MessageRole`
- `ConversationMessage`, `MessageEntry`
- `SessionEntry`
- `ParsedSession`
- `SessionIndexEntry`, `SessionsIndex`

### 5. Operation Types

Verify `src/types/operation-types.ts` exports:
- `EditOptions`, `EditStatistics`, `EditResult`
- `CloneOptions`, `CloneStatistics`, `CloneResult`
- `ListOptions`, `InfoOptions`, `SessionInfo`
- `RestoreOptions`

### 6. Tool Removal Types

Verify `src/types/tool-removal-types.ts` exports:
- `TurnBoundary`
- `ToolRemovalPreset`
- `ToolRemovalOptions`, `ResolvedToolRemovalOptions`
- `ToolRemovalStatistics`, `ToolRemovalResult`
- `TRUNCATION_LIMITS`
- `truncateString`, `truncateArguments`, `truncateToolResult`

### 7. Test Fixtures

Verify `tests/fixtures/sessions.ts` exports:
- `FIXTURE_SESSION_HEADER`
- `FIXTURE_USER_MESSAGE`
- `FIXTURE_ASSISTANT_WITH_TOOL`
- `FIXTURE_TOOL_RESULT`
- `FIXTURE_ASSISTANT_RESPONSE`
- `createSessionWithTurns()`
- `createSessionIndex()`

### 8. Type Index Re-exports

Verify `src/types/index.ts` re-exports all types from the other type files.

### 9. Stub Functions Throw NotImplementedError

Story 0 requires all runtime functions to be stubs that throw `NotImplementedError`. Verify that:

- `truncateString()` throws `NotImplementedError`
- `truncateArguments()` throws `NotImplementedError`
- `truncateToolResult()` throws `NotImplementedError`

No function should contain actual implementation logic. Each should have a body consisting only of:
```typescript
throw new NotImplementedError("functionName");
```

### 10. No Runtime Behavior

Verify that Story 0 infrastructure contains:
- Types and interfaces (no implementation)
- Error classes (constructors only)
- Test fixtures (data generators only)
- Stub functions that throw `NotImplementedError`

There should be NO:
- Actual algorithm implementations
- File I/O operations
- Session parsing logic
- Tool removal logic

## Verification Commands

```bash
# Check project structure
ls -la src/errors.ts src/types/*.ts tests/fixtures/sessions.ts

# Run typecheck
npm run typecheck

# Verify exports work (quick compile test)
npx tsc --noEmit src/types/index.ts
```

## Pass Criteria

- [ ] All files exist at specified paths (including `biome.json`)
- [ ] `npm run typecheck` exits with code 0
- [ ] No TypeScript errors
- [ ] All type exports accessible via `src/types/index.ts`
- [ ] All stub functions throw `NotImplementedError` (no real implementations)
- [ ] No runtime behavior exists in Story 0 code

## Fail Actions

If verification fails:
1. Document which checks failed
2. Note the specific error messages
3. Return to implementation to fix issues
