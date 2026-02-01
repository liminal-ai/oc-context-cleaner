# oc-context-cleaner Feature Review

## Findings (Ordered by Severity)

### High

1) Clone with custom output path skips session index registration
- Impact: Violates AC-4.9 and Flow 5. Clones created with `-o` are invisible to `occ list` and auto-detection, even when `--no-register` is not set.
- Evidence: `src/core/clone-operation-executor.ts:118`
- Recommendation: Register unless `--no-register` is set. If `outputPath` is outside the sessions dir, include `sessionFile` in the index entry or document that custom paths are not registerable.

### Medium

2) `toolCallsPreserved` statistics include truncated calls
- Impact: Output and JSON results overstate “preserved” tool calls. This makes the stats inconsistent with the spec and misleading to users.
- Evidence: `src/core/edit-operation-executor.ts:77` and `src/core/clone-operation-executor.ts:84`
- Recommendation: Calculate preserved as `original - removed - truncated` (or track a preserved count from the remover).

3) Configured JSON output is not honored on errors
- Impact: If config sets `outputFormat: "json"`, success outputs JSON but error paths still emit human text unless `--json` was passed. This breaks automation expectations.
- Evidence: `src/commands/edit-command.ts:73`, `src/commands/clone-command.ts:84`, `src/commands/list-command.ts:65`, `src/commands/info-command.ts:64`
- Recommendation: Use `outputFormat` (resolved from config/flags) for error serialization.

4) `stateDirectory` config is ignored by `occ list`
- Impact: `occ list` can read from the wrong directory when a config file sets `stateDirectory`. This violates AC-8.1/8.4 and makes list inconsistent with other commands.
- Evidence: `src/commands/list-command.ts:35` (does not pass `config.stateDirectory` to `agentExists`, `listAvailableAgents`, or `getSessionsSortedByTime`)
- Recommendation: Thread `config.stateDirectory` through list-related calls (including `agentExists` and `listAvailableAgents`).

5) Auto-detect current session prioritizes `sessions.json` over file mtimes
- Impact: If the index is stale, auto-detection may select the wrong session. The spec calls for “most-recently-modified file” detection.
- Evidence: `src/io/session-discovery.ts:90`
- Recommendation: Prefer filesystem mtime scan, or validate index entries against file mtimes.

6) Thinking blocks are only removed when tool calls exist
- Impact: Running `--strip-tools` on a session with thinking blocks but no tool calls will leave thinking blocks intact. The updated spec indicates thinking blocks should be stripped alongside tool removal.
- Evidence: `src/core/tool-call-remover.ts:44` and `src/core/tool-call-remover.ts:163`
- Recommendation: Strip thinking blocks whenever tool removal is requested, even if no tool calls are present, or clarify the intended behavior in the spec.

7) Truncated tool-call arguments are stored as strings
- Impact: The `arguments` field changes shape from object to string, which may violate OpenClaw’s expected schema and risk replay/parsing failures.
- Evidence: `src/core/tool-call-remover.ts:296`
- Recommendation: Preserve the object shape (e.g., `{ _truncated: "..." }`) or confirm OpenClaw accepts stringified arguments.

### Low

8) Edit does not update `sessions.json` timestamps
- Impact: The index can drift from the file’s true modification time, affecting list ordering and auto-detection when the index is used.
- Evidence: No call to `updateSessionTimestamp` in `src/core/edit-operation-executor.ts` after `writeSessionFile`.
- Recommendation: Call `updateSessionTimestamp` after successful edits.

9) Error hint references a non-existent flag
- Impact: Error guidance suggests `occ list --all-agents`, but no such flag exists.
- Evidence: `src/commands/edit-command.ts:96` and `src/commands/clone-command.ts:107`
- Recommendation: Remove or implement the flag, or update the hint.

---

## Spec Alignment

- Core flows (edit, clone, list, info, restore) are implemented and generally track the feature spec and tech design.
- Notable deviations from the spec:
  - Clone with `-o` does **not** register in the session index unless outputPath is omitted (Finding #1).
  - Auto-detect current session uses the index first instead of file mtimes (Finding #5).
  - Thinking block removal is conditional on tool calls (Finding #6).
  - `occ list` ignores configured `stateDirectory` (Finding #4).
  - Edit does not update session index timestamps (Finding #8).

Overall, the feature is close to spec-complete, with a small set of misalignments that are fixable without architectural changes.

---

## Code Quality

- Clear layering (commands → core → io → output) mirrors the tech design and keeps logic testable.
- Atomic write patterns and backup rotation are well-implemented and easy to reason about.
- Types are well-scoped and match the OpenClaw JSONL format assumptions.
- Minor maintainability opportunities:
  - `removeToolCalls` does an O(n²) turn lookup via `find` each message; an index map would be simpler and faster for large transcripts.
  - Tool truncation logic mutates schema; consider centralizing a “safe truncation” strategy.

---

## Error Handling

- Errors are consistently wrapped in `OccError` subclasses and surfaced with actionable hints.
- Atomic writes and backups reduce the risk of corrupting session files.
- Error output format inconsistency (Finding #3) is the primary issue; otherwise error messaging aligns with spec.

---

## Test Coverage

- Strong coverage of algorithm behavior, CLI entry points, and config precedence.
- Good attention to backup rotation, JSON output, and edge conditions.
- Gaps / missing tests:
  - Clone with `-o` should still register unless `--no-register` (Finding #1).
  - `stateDirectory` config applied to `occ list` (Finding #4).
  - Error output format when config sets `outputFormat: "json"` (Finding #3).
  - Edit updates session index timestamp (Finding #8).
  - Thinking block removal when no tools but `--strip-tools` is set (Finding #6), depending on intended behavior.

---

## Edge Cases

- Sessions that start with assistant/tool messages (no initial user) are not assigned to a turn; tool calls in these messages won’t be stripped.
- `toolCallsPreserved` stats may be misleading when truncation is partial (Finding #2).
- Index staleness can mislead auto-detection or list ordering (Findings #5 and #8).

---

## What’s Done Well

- Thoughtful CLI UX (quickstart, JSON output, hints) with good usability for agents.
- Safe filesystem operations: backups, rotations, and atomic writes are consistent.
- Tool-removal algorithm aligns with the turn-based approach from ccs-cloner.
- Configuration system is cleanly layered and validated.
- Tests are comprehensive and well-structured around AC/TC mappings.

---

## What Could Be Better

- Tighten spec alignment for clone registration, session auto-detect, and thinking block removal behavior.
- Normalize statistics semantics (preserved vs truncated) to keep outputs trustworthy.
- Ensure config-driven output format affects both success and error paths.
- Confirm schema compatibility for truncated tool arguments.

---

## Recommendations (Actionable)

1) Fix clone index registration when `-o` is used (Finding #1) and add a test.
2) Correct `toolCallsPreserved` calculation and adjust output tests accordingly (Finding #2).
3) Respect `config.outputFormat` for error output in all commands (Finding #3).
4) Thread `stateDirectory` through list/agent discovery calls (Finding #4).
5) Revisit auto-detect ordering to match the “most-recently-modified file” requirement (Finding #5).
6) Decide and document the intended thinking-block stripping behavior, then align implementation + tests (Finding #6).
7) Validate tool-call argument schema expectations and update truncation strategy if needed (Finding #7).
8) Update session index timestamps on edit to keep list ordering accurate (Finding #8).

---

## Open Questions / Assumptions

- Is OpenClaw tolerant of `toolCall.arguments` being a string after truncation, or must it remain an object?
- Should thinking blocks be removed whenever `--strip-tools` is used, even if no tool calls exist?
- Is the session index authoritative for “current session,” or should file mtime always win?

