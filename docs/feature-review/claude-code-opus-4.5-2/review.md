# Code Review: oc-context-cleaner

**Reviewer:** Claude Opus 4.5
**Date:** 2026-02-01
**Scope:** Full feature review of oc-context-cleaner CLI tool

---

## Executive Summary

The oc-context-cleaner (occ) is a well-architected CLI tool for managing OpenClaw session transcripts through intelligent tool call stripping. The implementation demonstrates strong adherence to the feature specification and tech design, with clean separation of concerns and comprehensive test coverage. The codebase successfully handles the known deviations noted in the task context, including thinking block removal, config wiring, and the `--strip-tools` boolean bug.

**Overall Assessment:** Production-ready with minor recommendations for improvement.

| Category | Rating | Notes |
|----------|--------|-------|
| Spec Alignment | Excellent | All acceptance criteria implemented |
| Code Quality | Very Good | Clean architecture, minor duplication |
| Error Handling | Excellent | Comprehensive with actionable hints |
| Test Coverage | Excellent | 81 tests, all passing |
| Edge Cases | Good | Most handled, a few gaps noted |

---

## 1. Spec Alignment

### Feature Spec Coverage

The implementation successfully covers all acceptance criteria from the feature spec:

**Session Discovery & Listing (AC-1.x):** Complete
- `occ list` displays all sessions sorted by recency
- Limit flag (`-n`) works correctly
- JSON output is valid and complete
- Partial session ID matching implemented
- Agent auto-detection via `CLAWDBOT_AGENT_ID` environment variable
- Actionable error messages when agent not found

**Session Analysis (AC-2.x):** Complete
- `occ info` displays comprehensive statistics
- Message counts, tool calls, token estimation, file size all implemented
- JSON output contains all required fields
- Empty sessions handled gracefully

**Edit Operation (AC-3.x):** Complete
- Edit modifies session in place with automatic backup
- Atomic write via temp file + rename pattern
- Session ID unchanged after edit (resumable)
- Auto-detect current session via most-recently-modified heuristic
- JSON output matches `EditResult` contract

**Clone Operation (AC-4.x):** Complete
- Clone creates new UUID
- Header includes `clonedFrom` and `clonedAt` metadata
- Custom output path (`-o`) supported
- `--no-register` skips index update
- Resume command included in output

**Tool Call Stripping (AC-5.x):** Complete
- Default preset: keep 20 turns, truncate 50%
- Aggressive preset: keep 10 turns, truncate 50%
- Extreme preset: remove all tool calls
- No dangling tool references after removal
- Truncation respects 120 chars / 2 lines limits
- Thinking blocks removed when tool stripping is active

**Backup & Restore (AC-6.x):** Complete
- Backups use monotonic numbering
- Rotation maintains max 5 backups
- Restore from most recent backup works
- Graceful failure when no backup exists

**Output & Usability (AC-7.x):** Complete
- Human-readable output with clear formatting
- JSON output for programmatic use
- Verbose mode with detailed statistics
- Quickstart help (~250 tokens, agent-friendly)
- Exit codes: 0 for success, non-zero for failure

**Configuration (AC-8.x):** Complete
- Config from standard locations via c12
- Custom presets supported
- Environment variables override config file
- CLI flags override environment variables

### Tech Design Conformance

The implementation closely follows the tech design document:

- **Module structure** matches the design exactly
- **Type definitions** are faithful to the spec
- **Flow diagrams** accurately describe the implemented behavior
- **Error classes** match the design specification

### Resolved Deviations

All known deviations mentioned in the task context are properly addressed:

1. **Thinking Block Removal:** `ThinkingBlock` type added to `session-types.ts`, removal logic implemented in `tool-call-remover.ts`, statistics track `thinkingBlocksRemoved`.

2. **Config Wiring:** Commands properly pass `config.stateDirectory` through to path functions. This is visible in `edit-command.ts`, `clone-command.ts`, `info-command.ts`, `list-command.ts`, and `restore-command.ts`.

3. **--strip-tools Boolean Bug:** Fixed in both `edit-command.ts` (lines 48-52) and `clone-command.ts` (lines 57-61) with the pattern:
   ```typescript
   const presetName =
       typeof args["strip-tools"] === "string"
           ? args["strip-tools"]
           : config.defaultPreset;
   ```

---

## 2. Code Quality

### Architecture

The codebase demonstrates excellent separation of concerns:

```
src/
├── commands/     # CLI entry points (thin wrappers)
├── core/         # Business logic (pure functions where possible)
├── io/           # Filesystem operations
├── config/       # Configuration management
├── output/       # Formatting for human/JSON output
└── types/        # TypeScript type definitions
```

This layered architecture enables:
- Testing at appropriate levels (commands with mocked FS, algorithms without mocks)
- Clear ownership of responsibilities
- Easy extension for future features

### Type Safety

Strong type safety throughout:

- No use of `any` type in production code
- Discriminated unions for message types (`SessionEntry = SessionHeader | MessageEntry`)
- Explicit return types on all exported functions
- Type guards (`isSessionHeader`, `isMessageEntry`) for runtime discrimination

**Minor issue:** The `truncateToolCallsInMessage` function stores truncated arguments as a string but casts it to `Record<string, unknown>`:

```typescript
// src/core/tool-call-remover.ts, line 311-312
arguments: truncatedArgs as unknown as Record<string, unknown>,
```

This is a deliberate design choice per the tech design (storing truncated string directly), but the type assertion could be cleaner with a dedicated `TruncatedToolCallBlock` type.

### Code Duplication

Minimal duplication observed. One notable case:

The `countToolCalls` function is duplicated in:
- `src/core/edit-operation-executor.ts` (lines 150-158)
- `src/core/clone-operation-executor.ts` (lines 220-228)

**Recommendation:** Extract to a shared utility in `src/core/tool-call-remover.ts` or `src/core/turn-boundary-calculator.ts`.

### Naming Conventions

Excellent naming throughout:
- Functions describe their purpose clearly (`removeToolCallsFromMessage`, `truncateToolResultMessage`)
- Types are self-documenting (`ResolvedToolRemovalOptions`, `TurnBoundary`)
- Constants are uppercase (`MAX_BACKUPS`, `TRUNCATION_LIMITS`)

### Comments and Documentation

Good JSDoc coverage on public interfaces. Key algorithms have explanatory comments:

```typescript
// src/core/tool-call-remover.ts
/**
 * Remove/truncate tool calls from session entries based on preset rules.
 *
 * Algorithm:
 * 1. Identify turn boundaries
 * 2. Find turns with tool calls
 * 3. Classify: preserve (newest), truncate (middle), remove (oldest)
 * 4. Process entries accordingly
 * 5. Remove orphaned tool results
 * 6. Strip thinking blocks when any tools are touched
 */
```

---

## 3. Error Handling

### Error Hierarchy

Well-designed error class hierarchy:

```
OccError (base)
├── NotImplementedError
├── SessionNotFoundError
├── AmbiguousSessionError
├── EditOperationError
├── CloneOperationError
├── RestoreError
├── NoSessionsError
├── UnknownPresetError
└── AgentNotFoundError
```

Each error includes:
- Meaningful message
- Error code for programmatic handling
- Contextual data (e.g., `availableAgents` on `AgentNotFoundError`)

### Actionable Hints

Commands provide resolution hints based on error type:

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

This is excellent for CLI usability, especially for agent self-invocation.

### Atomic Operations

Proper atomicity through temp file + rename:

```typescript
// src/io/session-file-writer.ts
async function writeSessionFile(filePath, entries): Promise<void> {
    const tempPath = join(dir, `.tmp-${randomUUID()}.jsonl`);
    try {
        await writeFile(tempPath, content, "utf-8");
        await rename(tempPath, filePath);
    } catch (error) {
        try { await unlink(tempPath); } catch { /* ignore */ }
        throw error;
    }
}
```

This ensures no partial files on failure.

---

## 4. Test Coverage

### Test Statistics

- **Total tests:** 81
- **Passing:** 81 (100%)
- **Test files:** 8
- **Duration:** ~571ms

### Test Distribution

| Test File | Tests | Coverage |
|-----------|-------|----------|
| tool-call-remover.test.ts | 15 | Core algorithm, all presets |
| configuration-loader.test.ts | 11 | Config merging, env vars |
| edit-command.test.ts | 19 | Full edit flow |
| clone-command.test.ts | 11 | Full clone flow |
| list-command.test.ts | 11 | Session discovery |
| info-command.test.ts | 8 | Session analysis |
| restore-command.test.ts | 3 | Backup recovery |
| main-command.test.ts | 3 | Help and quickstart |

### Testing Strategy

The implementation follows the tech design's testing strategy:

1. **Command tests** (PRIMARY): Test full flows with mocked filesystem via memfs
2. **Algorithm tests** (SUPPLEMENTAL): Test pure functions without mocks
3. **No internal module mocking**: IO layer exercised through commands

### Test Quality

Tests are well-structured:
- Clear descriptions matching TC identifiers
- Proper setup/teardown with `beforeEach`/`afterEach`
- Assertions verify both positive and negative cases

Example of good test structure:

```typescript
// TC-5.1a: Default keeps 20 turns with tools
it("default preset keeps last 20 turns with tools", () => {
    const entries = createSessionWithTurns(30, 1);
    const options: ResolvedToolRemovalOptions = {
        keepTurnsWithTools: 20,
        truncatePercent: 50,
    };

    const result = removeToolCalls(entries, options);

    expect(result.statistics.turnsWithToolsRemoved).toBe(10);
    expect(result.statistics.turnsWithToolsPreserved +
           result.statistics.turnsWithToolsTruncated).toBe(20);
});
```

### Fixtures

The `tests/fixtures/sessions.ts` provides excellent helpers:
- `createSessionWithTurns(turnCount, toolsPerTurn)` for basic sessions
- `createSessionWithThinking(turnCount, toolsPerTurn, includeThinking)` for thinking block tests
- `createSessionIndex(sessionIds)` for index testing

---

## 5. Edge Cases

### Handled Edge Cases

1. **Empty sessions:** Handled gracefully with zero counts (TC-2.7a)
2. **Sessions without tools:** Processed unchanged (TC-5.8a)
3. **Missing backup:** Throws RestoreError with actionable message (TC-6.4a)
4. **Ambiguous partial ID:** Lists matching sessions (TC-1.6b)
5. **Invalid agent:** Lists available agents (TC-1.9a)
6. **Orphaned tool results:** Removed to prevent dangling references
7. **Orphaned tool calls:** Removed (handles interrupted sessions)

### Potential Gaps

1. **Concurrent access:** No locking mechanism. If the OpenClaw agent modifies the session file while occ is processing, results are undefined. This is likely acceptable given the 45-second TTL cache design, but worth documenting.

2. **Very large sessions:** No streaming parser. Entire session loaded into memory. For extremely large sessions (100MB+), this could be problematic.

3. **Malformed JSONL:** The parser (`parseJsonl`) does not gracefully handle malformed lines. A single invalid JSON line will crash parsing for the entire session.

4. **Session index out of sync:** If session files exist but `sessions.json` is empty/missing, the tool falls back to filesystem scan. This works, but the fallback could be more explicitly tested.

5. **Clock skew:** Backup rotation uses monotonic numbering which is resilient, but session "most recent" detection uses mtime which could be affected by clock skew.

---

## 6. What's Done Well

### 1. Clean Architecture

The layered architecture with clear boundaries makes the code highly maintainable. Each module has a single responsibility:
- Commands parse args and format output
- Core modules contain business logic
- IO modules handle filesystem operations

### 2. Faithful Spec Implementation

The implementation closely matches both the feature spec and tech design. The data contracts (`EditResult`, `CloneResult`, `SessionInfo`) exactly match the spec definitions.

### 3. Comprehensive Error Handling

Every error path provides actionable guidance. This is crucial for agent self-invocation where clear, structured error messages enable autonomous recovery.

### 4. Thinking Block Removal

The decision to strip thinking blocks when tool stripping is active is well-implemented. The conditional logic (`willTouchTools`) ensures thinking blocks are preserved when no tools are touched, maintaining session fidelity for pure-text sessions.

### 5. Atomic File Operations

All write operations use the temp-file-rename pattern, ensuring no partial files on failure. This is critical for maintaining session integrity.

### 6. Test Fixtures

The session fixture generators are excellent. `createSessionWithTurns()` and `createSessionWithThinking()` make it easy to create realistic test data with controllable parameters.

### 7. Configuration Flexibility

The layered config system (CLI > env > file > defaults) provides flexibility without complexity. The c12 integration handles standard config file locations automatically.

### 8. Quickstart Help

The ~250 token quickstart text is well-designed for agent consumption:
- Clear structure (WHEN TO USE, PRESETS, COMMON COMMANDS)
- All common operations covered
- No unnecessary verbosity

---

## 7. What Could Be Better

### 1. Code Duplication

The `countToolCalls` helper is duplicated between edit and clone executors. This should be extracted to a shared utility.

### 2. Type Assertion for Truncated Arguments

The cast of truncated arguments to `Record<string, unknown>` is a pragmatic solution but loses type safety. A discriminated union or separate type would be cleaner:

```typescript
// Option: Separate type for truncated blocks
interface TruncatedToolCallBlock {
    type: "toolCall";
    id: string;
    name: string;
    truncatedArguments: string;  // Explicit string type
}
```

### 3. Global Config Singleton

`get-config.ts` uses a module-level singleton that's never reset:

```typescript
let resolvedConfig: ResolvedConfiguration | null = null;
```

This works for CLI usage but complicates testing (must mock before first import) and prevents runtime config reloading. Consider using dependency injection or adding a `resetConfig()` for testing.

### 4. Hardcoded Backup Path Format

The backup naming pattern (`{id}.backup.{n}.jsonl`) is hardcoded in multiple places. Consider extracting to a constant or utility function for consistency.

### 5. Limited Streaming Support

Session files are fully loaded into memory. For production use with large sessions, consider a streaming JSONL parser that processes entries incrementally.

### 6. No Input Validation on Session ID Format

The code accepts any string as a session ID and only validates it exists on disk. Consider validating UUID format for explicit session IDs to catch typos early.

### 7. consola Dependency Unused

`consola` is in dependencies but not used in the implementation (direct `console.log`/`console.error` calls instead). Either use consola or remove the dependency.

---

## 8. Recommendations

### High Priority

1. **Extract duplicated `countToolCalls`** to a shared utility to reduce maintenance burden.

2. **Add streaming parser fallback** for sessions over a configurable size threshold (e.g., 10MB) to handle very large sessions gracefully.

3. **Validate JSONL on parse** with graceful error recovery (skip malformed lines with warning) rather than crashing on first invalid line.

### Medium Priority

4. **Add config reset for testing** to avoid test pollution from module-level singleton.

5. **Remove unused `consola` dependency** or refactor to use it for consistent logging.

6. **Extract backup path pattern** to a constant in `paths.ts`.

### Low Priority

7. **Consider UUID validation** for explicit session IDs to catch typos.

8. **Add type for truncated tool calls** to improve type safety.

9. **Document concurrent access limitations** in README or code comments.

---

## 9. Security Considerations

The implementation does not exhibit security concerns:

- No network calls or external API access
- File operations restricted to configured state directory
- No execution of arbitrary code
- No credential handling
- Atomic writes prevent corruption

The backup rotation (max 5) prevents disk exhaustion from repeated operations.

---

## 10. Conclusion

The oc-context-cleaner implementation is production-ready and demonstrates high engineering quality. The code faithfully implements the feature specification with clean architecture, comprehensive error handling, and thorough test coverage.

The codebase successfully handles all the known deviations mentioned in the task context:
- Thinking block removal is implemented and tested
- Config wiring is properly connected through all commands
- The `--strip-tools` boolean bug is fixed with appropriate type checking

The 81 passing tests provide confidence in the implementation's correctness. The recommendations above are minor improvements that would enhance maintainability and robustness but are not blockers for production use.

**Verdict:** Approved for production with minor recommendations.

---

## Appendix: File Summary

### Source Files (34 files)

| File | Lines | Purpose |
|------|-------|---------|
| src/errors.ts | 122 | Error class hierarchy |
| src/types/session-types.ts | 146 | OpenClaw session types |
| src/types/operation-types.ts | 140 | Edit/clone operation types |
| src/types/tool-removal-types.ts | 149 | Tool removal algorithm types |
| src/types/configuration-types.ts | 32 | Config types |
| src/types/index.ts | 55 | Type re-exports |
| src/core/turn-boundary-calculator.ts | 81 | Turn boundary identification |
| src/core/tool-call-remover.ts | 389 | Core stripping algorithm |
| src/core/session-parser.ts | 66 | JSONL parsing |
| src/core/backup-manager.ts | 172 | Backup creation/rotation |
| src/core/edit-operation-executor.ts | 159 | Edit orchestration |
| src/core/clone-operation-executor.ts | 229 | Clone orchestration |
| src/io/paths.ts | 81 | Path resolution |
| src/io/session-discovery.ts | 209 | Session finding |
| src/io/session-file-reader.ts | 82 | File reading |
| src/io/session-file-writer.ts | 63 | Atomic file writing |
| src/io/session-index-reader.ts | 43 | Index reading |
| src/io/session-index-writer.ts | 81 | Index writing |
| src/commands/main-command.ts | 85 | Root command |
| src/commands/edit-command.ts | 118 | Edit command |
| src/commands/clone-command.ts | 129 | Clone command |
| src/commands/list-command.ts | 82 | List command |
| src/commands/info-command.ts | 136 | Info command |
| src/commands/restore-command.ts | 47 | Restore command |
| src/config/configuration-loader.ts | 130 | c12-based config loading |
| src/config/configuration-schema.ts | 21 | Zod validation |
| src/config/default-configuration.ts | 12 | Default values |
| src/config/tool-removal-presets.ts | 60 | Built-in presets |
| src/config/get-config.ts | 17 | Config singleton |
| src/output/result-formatter.ts | 154 | Edit/clone formatting |
| src/output/list-formatter.ts | 70 | List formatting |
| src/output/info-formatter.ts | 31 | Info formatting |
| src/cli.ts | 10 | CLI entry point |
| src/index.ts | 26 | SDK exports |

### Test Files (9 files)

| File | Tests | Coverage |
|------|-------|----------|
| tests/fixtures/sessions.ts | - | Test data generators |
| tests/algorithms/tool-call-remover.test.ts | 15 | Core algorithm |
| tests/commands/edit-command.test.ts | 19 | Edit flow |
| tests/commands/clone-command.test.ts | 11 | Clone flow |
| tests/commands/list-command.test.ts | 11 | List flow |
| tests/commands/info-command.test.ts | 8 | Info flow |
| tests/commands/restore-command.test.ts | 3 | Restore flow |
| tests/commands/main-command.test.ts | 3 | Help/quickstart |
| tests/config/configuration-loader.test.ts | 11 | Config loading |

**Total:** 81 tests passing
