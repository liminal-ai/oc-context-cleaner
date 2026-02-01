# Feature Review: oc-context-cleaner

**Reviewer:** Claude Opus 4.5
**Date:** 2026-02-01
**Implementation Status:** Complete
**Test Results:** 81/81 passing

---

## Executive Summary

The oc-context-cleaner implementation is a well-architected, production-ready CLI tool that successfully delivers on its core promise: enabling OpenClaw agents to self-maintain their context by stripping old tool calls. The implementation demonstrates disciplined engineering practices, comprehensive test coverage, and thoughtful alignment with both the feature specification and technical design.

The code quality is high. The architecture follows clean separation of concerns, types are properly defined without use of `any`, error handling is consistent, and the test suite exercises real behavior rather than mocking internal modules.

**Overall Assessment:** Strong implementation with minor opportunities for improvement. Ready for production use.

---

## 1. Spec Alignment

### Feature Spec Coverage

| Acceptance Criteria | Status | Notes |
|---------------------|--------|-------|
| AC-1.x (Session Discovery) | Complete | List, partial ID matching, agent detection all implemented |
| AC-2.x (Session Analysis) | Complete | Info command with accurate statistics |
| AC-3.x (Edit Operation) | Complete | In-place editing with atomic writes and backups |
| AC-4.x (Clone Operation) | Complete | New UUID generation, index registration, `--no-register` |
| AC-5.x (Tool Stripping) | Complete | Turn-based algorithm, presets, truncation limits |
| AC-6.x (Backup & Restore) | Complete | Monotonic numbering, rotation, restore command |
| AC-7.x (Output & Usability) | Complete | Human/JSON formats, verbose mode, quickstart help |
| AC-8.x (Configuration) | Complete | c12-based loading, env var override, custom presets |

### Known Deviations (Handled Well)

1. **Thinking Block Removal:** Originally out of scope per the spec, but correctly added during implementation when it was discovered that OpenClaw sessions contain thinking blocks that the Anthropic API rejects. The implementation strips thinking blocks alongside tool calls when stripping is active. This is documented in the updated spec.

2. **Config Wiring:** Config values (`stateDirectory`, `defaultAgentId`) are properly passed through to path functions. Commands respect the configuration hierarchy: CLI > env > config file > defaults.

3. **`--strip-tools` Boolean Bug:** The fix correctly detects when citty sets the flag to boolean `true` (user ran `--strip-tools` without a value) and uses `config.defaultPreset` instead.

### Tech Design Conformance

The implementation closely follows the tech design:

- Module structure matches the specified architecture
- Function signatures align with the documented interfaces
- The flow diagrams accurately describe the implemented behavior
- All error classes from the design are present and used appropriately

---

## 2. Code Quality

### Architecture Strengths

**Clean Layered Architecture:**
```
commands/  -> User interface (CLI parsing, output formatting)
core/      -> Business logic (tool removal, backup management)
io/        -> Filesystem operations (read/write, discovery)
output/    -> Formatting (human-readable, JSON)
config/    -> Configuration loading and preset resolution
types/     -> TypeScript type definitions
```

This separation enables testing at each layer and makes the codebase navigable.

**Dependency Flow:** Commands depend on core and io. Core depends only on types. IO depends only on paths and types. No circular dependencies.

**No `any` Types:** The codebase maintains strict typing throughout. Even in the tricky areas (content block unions, citty command args), the code uses proper type guards and explicit typing.

### Code Patterns

**Atomic File Operations:** Both `writeSessionFile` and `copyFileAtomic` use the temp-file-then-rename pattern:

```typescript
// src/io/session-file-writer.ts
const tempPath = join(dir, `.tmp-${randomUUID()}.jsonl`);
try {
  await writeFile(tempPath, content, "utf-8");
  await rename(tempPath, filePath);
} catch (error) {
  try { await unlink(tempPath); } catch { /* ignore */ }
  throw error;
}
```

This correctly prevents partial writes and maintains data integrity.

**Turn-Based Algorithm:** The tool removal algorithm operates on turns (not percentages), which prevents degradation across repeated operations. This matches the learnings from ccs-cloner:

```typescript
// Classify turns into preserve/truncate/remove
const keepCount = Math.min(keepTurnsWithTools, total);
const removeCount = total - keepCount;
const truncateCount = Math.floor(keepCount * (truncatePercent / 100));
```

**Type Guards:** Proper use of type guards for discriminated unions:

```typescript
export function isSessionHeader(entry: SessionEntry): entry is SessionHeader {
  return entry.type === "session";
}

export function isMessageEntry(entry: SessionEntry): entry is MessageEntry {
  return entry.type === "message";
}
```

### Readability

The code is well-organized with:
- Consistent file structure across modules
- JSDoc comments on public functions
- Clear function names that describe behavior
- Logical grouping of related functionality

---

## 3. Error Handling

### Error Class Hierarchy

The implementation defines a comprehensive error hierarchy:

```typescript
OccError (base)
  |-- SessionNotFoundError
  |-- AmbiguousSessionError
  |-- EditOperationError
  |-- CloneOperationError
  |-- RestoreError
  |-- NoSessionsError
  |-- UnknownPresetError
  |-- AgentNotFoundError
  |-- NotImplementedError (development only)
```

Each error includes:
- A descriptive message
- An error code for programmatic handling
- Contextual data where applicable (e.g., `matches` array on `AmbiguousSessionError`)

### Error Handling Patterns

**Commands provide actionable hints:**

```typescript
// src/commands/edit-command.ts
switch (error.code) {
  case "SESSION_NOT_FOUND":
    console.error("Hint: Use 'occ list' to see available sessions");
    break;
  case "AMBIGUOUS_SESSION":
    console.error("Hint: Provide more characters of the session ID to disambiguate");
    break;
  // ...
}
```

**Consistent exit codes:** Success returns 0, failure returns 1, as specified.

**JSON error output:** When `--json` is specified, errors are formatted as JSON objects with `success: false` and `error` message.

### Areas of Excellence

- ENOENT errors are consistently caught and converted to domain errors
- Agent existence is verified before operations
- Backup failures don't leave partial files

---

## 4. Test Coverage

### Test Strategy

The implementation follows the service mock pattern from the tech design:

1. **Command tests** (primary coverage): Exercise full flows through the CLI entry points with mocked filesystem
2. **Algorithm tests** (supplemental): Test pure functions with no mocks needed
3. **Config tests**: Verify configuration loading and preset resolution

### Test Distribution

| Test File | Tests | Coverage Area |
|-----------|-------|---------------|
| edit-command.test.ts | 19 | Edit flow, backup, output formatting |
| clone-command.test.ts | 11 | Clone flow, index registration |
| list-command.test.ts | 11 | Session listing, sorting, agents |
| info-command.test.ts | 8 | Session analysis, statistics |
| restore-command.test.ts | 3 | Backup restoration |
| main-command.test.ts | 3 | Help, quickstart |
| tool-call-remover.test.ts | 15 | Core algorithm, thinking blocks |
| configuration-loader.test.ts | 11 | Config loading, env vars |
| **Total** | **81** | |

### Test Quality

**What's tested well:**
- Happy paths for all commands
- Error cases (session not found, ambiguous ID, no backup)
- Edge cases (empty session, no tools, max backups)
- Output formats (human and JSON)
- Turn classification algorithm
- Thinking block removal
- Truncation limits

**Appropriate mocking:**
- Only the filesystem (`node:fs/promises`) is mocked via memfs
- Internal modules (tool-call-remover, backup-manager) run real code
- Configuration module has c12 mocked to control config file scenarios

### Test Count vs. Estimate

The tech design estimated 67 tests; the implementation has 81. The additional tests cover:
- Thinking block removal (added during implementation)
- `--strip-tools` boolean handling bug fix
- Additional edge cases discovered during development

---

## 5. Edge Cases

### Well-Handled Edge Cases

1. **Empty sessions:** Handled gracefully with zero counts, not errors
2. **Sessions without tool calls:** Pass through unchanged
3. **Partial ID matching:** Single match returns, multiple matches throw `AmbiguousSessionError`
4. **Backup rotation:** Correctly maintains max 5 backups with monotonic numbering
5. **Orphaned tool references:** Both orphaned tool results AND orphaned tool calls are cleaned up

### Interrupted Session Handling

The code handles interrupted sessions (tool called but never returned):

```typescript
// Remove orphaned tool calls (calls without results)
const cleanedMessages = finalMessages.map((msg) => {
  if (msg.message.role === "assistant" && Array.isArray(msg.message.content)) {
    const filteredContent = msg.message.content.filter((block) => {
      if (block.type === "toolCall") {
        return keptToolResultIds.has(block.id);
      }
      return true;
    });
    // ...
  }
});
```

### Potential Edge Cases to Consider

1. **Very large sessions:** The implementation reads entire session files into memory. For sessions with thousands of turns, this could be problematic. A streaming JSONL parser would be more memory-efficient, but this is likely premature optimization for typical use cases.

2. **Concurrent writes:** If OpenClaw and occ write simultaneously, race conditions could occur. The atomic write pattern mitigates data corruption but doesn't prevent one write from overwriting another. The 45-second TTL cache in OpenClaw provides some protection.

3. **Filesystem errors during backup rotation:** If deleting an old backup fails, the code continues (only ENOENT is ignored). This could leave extra backups but doesn't break functionality.

---

## 6. What's Done Well

### Engineering Excellence

1. **Strict TypeScript:** No `any` types anywhere in the codebase. Proper generics, type guards, and discriminated unions throughout.

2. **Atomic Operations:** All file writes use temp-file-then-rename. No partial writes possible.

3. **Test Architecture:** Tests exercise real code paths through command entry points rather than testing implementation details.

4. **Configuration Hierarchy:** Proper precedence (CLI > env > config > defaults) with clear documentation.

5. **Error Messages:** Every error type has actionable hints for users.

### Design Decisions

1. **Turn-based stripping:** Using turn counts instead of percentages prevents degradation over repeated operations. This is a learning from ccs-cloner that's correctly applied here.

2. **Edit as primary mode:** The 45-second TTL cache validation made edit-in-place viable, which is a better UX than always needing to switch sessions.

3. **Thinking block removal:** Recognizing that thinking blocks are problematic for the Anthropic API and adding removal logic shows good attention to the actual usage context.

4. **Truncation markers:** Different markers for arguments (`...`) vs content (`[truncated]`) help users understand what was truncated.

### Documentation

1. **Feature spec is comprehensive:** Complete acceptance criteria with testable conditions
2. **Tech design provides clear blueprint:** Module boundaries, flow diagrams, interface definitions
3. **Quickstart text is agent-friendly:** ~250 tokens of immediately useful information

---

## 7. What Could Be Better

### Minor Issues

1. **Duplicate `countToolCalls` functions:** Both `edit-operation-executor.ts` and `clone-operation-executor.ts` have identical implementations:

```typescript
function countToolCalls(entries: readonly SessionEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    if (isMessageEntry(entry)) {
      count += getToolCallIds(entry).length;
    }
  }
  return count;
}
```

This could be extracted to a shared utility.

2. **Stats calculation duplication:** `calculateEditStatistics` and `calculateCloneStatistics` are nearly identical. They could share a base implementation with type-specific wrappers.

3. **Config singleton pattern:** The `getConfig()` function uses a module-level singleton:

```typescript
let resolvedConfig: ResolvedConfiguration | null = null;

export async function getConfig(): Promise<ResolvedConfiguration> {
  if (!resolvedConfig) {
    resolvedConfig = await loadConfiguration();
  }
  return resolvedConfig;
}
```

This works but makes testing harder (config can't be reset between tests without reimporting the module). A DI pattern would be more testable.

4. **Restore command dynamic import:** The restore command uses a dynamic import for `getConfig`:

```typescript
const { getConfig } = await import("../config/get-config.js");
```

This is inconsistent with other commands that import statically. The comment suggests this was done to avoid circular dependencies, but the reason isn't obvious.

### Test Gaps

1. **No integration tests with real filesystem:** All tests use memfs. A small number of integration tests against a real temp directory would catch any memfs behavior differences.

2. **Limited output format testing:** While JSON output structure is verified, the human output tests mostly just check for presence of keywords rather than exact formatting.

3. **No performance tests:** Large session handling isn't tested. A benchmark with 1000+ turns would identify any performance issues.

### Documentation Gaps

1. **No README yet:** The package.json references a README.md but none exists.

2. **No inline comments for complex algorithm sections:** The turn classification logic in `classifyTurns` could use more explanation of the math.

---

## 8. Recommendations

### Priority 1: Address Before Production Use

None. The implementation is ready for production.

### Priority 2: Should Do Soon

1. **Extract shared utilities:**
   - Move `countToolCalls` to `src/core/session-parser.ts` or a new `src/core/session-utils.ts`
   - Create a base statistics calculation function

2. **Add README.md:**
   - Installation instructions
   - Basic usage examples
   - Preset descriptions
   - Configuration options

3. **Fix restore command import:**
   - Investigate and resolve the circular dependency issue
   - Use static import like other commands

### Priority 3: Nice to Have

1. **Streaming JSONL parser:** For memory efficiency with very large sessions

2. **Performance benchmarks:** Add a benchmark script for large sessions

3. **Integration test suite:** Small set of tests against real filesystem

4. **Consider DI for configuration:** Pass config as a parameter to executors instead of using singleton

### Code Snippet: Shared Statistics Calculation

```typescript
// src/core/statistics.ts
interface BaseStatistics {
  messagesOriginal: number;
  messagesResult: number;  // "After" or "Cloned"
  toolCallsOriginal: number;
  toolCallsRemoved: number;
  toolCallsTruncated: number;
  toolCallsPreserved: number;
  sizeOriginal: number;
  sizeResult: number;
  reductionPercent: number;
}

export function calculateStatistics(
  originalSize: number,
  resultSize: number,
  originalMessages: number,
  resultMessages: number,
  toolStats: {
    original: number;
    removed: number;
    truncated: number;
    preserved: number;
  },
): BaseStatistics {
  const reduction = originalSize > 0
    ? ((originalSize - resultSize) / originalSize) * 100
    : 0;

  return {
    messagesOriginal: originalMessages,
    messagesResult: resultMessages,
    toolCallsOriginal: toolStats.original,
    toolCallsRemoved: toolStats.removed,
    toolCallsTruncated: toolStats.truncated,
    toolCallsPreserved: toolStats.preserved,
    sizeOriginal: originalSize,
    sizeResult: resultSize,
    reductionPercent: Math.max(0, reduction),
  };
}
```

---

## 9. Summary

The oc-context-cleaner implementation is a solid, well-engineered CLI tool that meets all specified requirements. The code demonstrates:

- **Strong architecture:** Clean separation of concerns, testable modules
- **Type safety:** No `any` types, proper use of TypeScript features
- **Comprehensive testing:** 81 tests covering happy paths, errors, and edge cases
- **Good error handling:** Domain-specific errors with actionable hints
- **Production readiness:** Atomic operations, proper configuration handling

The known deviations from the original spec (thinking block removal, config wiring) were handled correctly and documented appropriately.

Minor improvements around code deduplication and documentation would polish the implementation further, but these don't block production use.

**Final Verdict:** Approved for production with minor recommendations.

---

## Appendix: Test Run Results

```
 ✓ tests/config/configuration-loader.test.ts (11 tests) 4ms
 ✓ tests/algorithms/tool-call-remover.test.ts (15 tests) 13ms
 ✓ tests/commands/list-command.test.ts (11 tests) 130ms
 ✓ tests/commands/restore-command.test.ts (3 tests) 152ms
 ✓ tests/commands/clone-command.test.ts (11 tests) 32ms
 ✓ tests/commands/main-command.test.ts (3 tests) 4ms
 ✓ tests/commands/edit-command.test.ts (19 tests) 47ms
 ✓ tests/commands/info-command.test.ts (8 tests) 172ms

 Test Files  8 passed (8)
      Tests  81 passed (81)
   Duration  772ms
```

Quality gates passed:
- `npm run typecheck`: Clean
- `npm run lint`: Clean (43 files, no fixes needed)
- `npm run test`: 81/81 passing
