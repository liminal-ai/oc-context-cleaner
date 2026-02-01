# oc-context-cleaner Feature Review (GPT-5.2 Thinking Extra High)

## Executive Summary

oc-context-cleaner is close to spec-complete and well-architected. The codebase largely matches the Tech Design’s intended layering (commands → core → io → output) and is backed by a solid test suite (81 passing tests). Tool stripping, backup rotation, partial-ID resolution, and agent-friendly UX (quickstart + JSON output) are all implemented in a pragmatic, testable way.

The remaining work is primarily about **tightening spec alignment** and **making behavior more consistent** across commands—especially around clone registration when `-o` is used, config propagation, statistics semantics, and error output formatting.

---

## Verification (What I Ran)

- ✅ `npm test` — **pass** (81/81)
- ✅ `npm run typecheck` — **pass**
- ❌ `npm run check` — **fail** (Biome reports many `organizeImports` errors across `src/` and `tests/`)

---

## Findings (Ordered by Severity)

### High

1) **Clone with `-o` skips session index registration even when `--no-register` is not set**
- **Spec impact:** Violates AC-4.9 (and Flow 2/Clone flow expectations). The spec explicitly says registration should still happen unless `--no-register` is passed.
- **User impact:** Clones written via `-o` become “invisible” to `occ list` and to auto-detection workflows.
- **Evidence:** `src/core/clone-operation-executor.ts` — index update is guarded by `!options.noRegister && !options.outputPath`.
- **Fix:** Register unless `--no-register` is set. If `outputPath` is outside the sessions directory, either:
  - store `sessionFile` in the index entry, or
  - document that custom output paths are export-only and cannot be registered.
- **Test gap:** No test asserts “`-o` still registers unless `--no-register`”.

2) **Configured `stateDirectory` is ignored by `occ list`**
- **Spec impact:** Violates AC-8.1/AC-8.4 expectations (“config wiring”) and makes `occ list` inconsistent with other commands that do pass `config.stateDirectory`.
- **User impact:** When `stateDirectory` is set via config file (not env), `occ list` may point at the wrong `~/.clawdbot` root and show “Agent not found” or an empty list.
- **Evidence:** `src/commands/list-command.ts` — does not pass `config.stateDirectory` to `agentExists`, `listAvailableAgents`, or `getSessionsSortedByTime`.
- **Fix:** Thread `config.stateDirectory` through all list-related IO calls and agent discovery checks.

---

### Medium

3) **`toolCallsPreserved` semantics appear to include truncated calls (overlapping categories)**
- **Spec impact:** The spec’s output examples and JSON contract imply disjoint counts for removed vs truncated vs preserved (preserved = full fidelity).
- **User impact:** Misleading statistics and confusing UX (“truncated” is a subset of “preserved” as implemented).
- **Evidence:** `src/core/edit-operation-executor.ts` and `src/core/clone-operation-executor.ts` compute preserved as `original - removed`.
- **Fix options:**
  - Compute preserved as `original - removed - truncated`, or
  - Rename fields to clarify that “preserved” means “remaining”, and add a separate “preservedFullFidelity” count.

4) **Error output format does not honor the resolved output format**
- **Spec impact:** The spec emphasizes dual-mode output for agent automation; users should be able to set `outputFormat: "json"` in config and reliably get JSON on both success and failure.
- **User impact:** Automation can break if success is JSON but errors revert to human text unless `--json` is explicitly passed.
- **Evidence:** `src/commands/edit-command.ts`, `src/commands/clone-command.ts`, `src/commands/list-command.ts`, `src/commands/info-command.ts` use `args.json` in error paths rather than the resolved `outputFormat`.
- **Fix:** Resolve output format once, then use it consistently for both success and error output.

5) **JSON-mode errors are emitted to stdout**
- **Spec/design impact:** Tech design’s external contract says errors go to stderr. Current behavior prints JSON error objects via `console.log`.
- **User impact:** Pipes like `occ ... --json | jq ...` may parse “error output” as data, and stderr remains empty even on failure.
- **Evidence:** Error handlers in commands use `console.log(JSON.stringify(...))` in JSON mode.
- **Fix:** Decide on a consistent contract:
  - either keep JSON errors on stdout (common CLI convention) and update docs/spec, or
  - move JSON errors to stderr to match the stated contract.

6) **Auto-detect “current session” consults `sessions.json` before filesystem mtimes**
- **Spec/design impact:** Tech design states “most-recently-modified heuristic”; using the index first can select the wrong session if the index is stale.
- **User impact:** `occ edit --strip-tools` could modify the wrong session in edge cases (stale index, missing index entries, etc.).
- **Evidence:** `src/io/session-discovery.ts` — `getCurrentSession()` prefers `getSessionsSortedByTime()` (index) before scanning `.jsonl` mtimes.
- **Fix:** Prefer filesystem mtime scan, or validate index entries against mtimes before trusting them.

7) **Thinking blocks are only stripped when tool calls exist**
- **Context:** The spec was updated to mark thinking block removal as a resolved defect because Anthropic rejects thinking blocks on replay.
- **Current behavior:** `removeToolCalls` strips thinking blocks only when there is at least one turn with a `toolCall` block.
- **User impact:** A session with thinking blocks but no tool calls can remain “unreplayable” if thinking blocks truly must always be removed for the replay target.
- **Evidence:** `src/core/tool-call-remover.ts` — `willTouchTools` is `turnsWithTools.length > 0`; thinking stripping is conditional on that.
- **Fix:** Consider stripping thinking blocks whenever tool removal is requested (or explicitly document/justify the conditional behavior).

---

### Low

8) **Edit does not update `sessions.json` timestamps**
- **Spec/design impact:** Flow 1 mentions updating session metadata; there is a dedicated `updateSessionTimestamp` helper that is currently unused.
- **User impact:** List ordering and index freshness can drift from file reality (especially if OpenClaw itself doesn’t update the index on external edits).
- **Evidence:** `src/io/session-index-writer.ts` exports `updateSessionTimestamp`, but it is never called after a successful edit.
- **Fix:** Call `updateSessionTimestamp(sessionId, agentId, stateDir)` after `writeSessionFile` succeeds.

9) **Error hint references a non-existent flag**
- **User impact:** Misleading remediation guidance.
- **Evidence:** `src/commands/edit-command.ts` and `src/commands/clone-command.ts` suggest `occ list --all-agents` but no such flag exists.
- **Fix:** Remove the hint or implement the flag.

10) **Biome check currently fails repo-wide**
- **User impact:** CI (or local “check”) will fail; contributors get noise unrelated to behavior.
- **Evidence:** `npm run check` shows many `assist/source/organizeImports` failures.
- **Fix:** Run `npm run format` (or `biome check --write`) and keep it green going forward.

---

## Spec Alignment (Feature Spec + Tech Design)

### What’s aligned / implemented well

- **Core commands exist and work:** `edit`, `clone`, `list`, `info`, `restore` are all present and functional.
- **Tool stripping:** Turn-based keep/truncate/remove behavior matches the spec intent, and tests cover default/aggressive/extreme presets.
- **Dangling-reference cleanup:** Tool results without matching tool calls are removed, and tool calls without results are filtered (interrupted-session safety).
- **Backups:** Monotonic numbering + max-5 rotation + restore from latest backup are implemented and tested.
- **Config system:** c12 + zod approach matches the tech design direction and the precedence model is sensible.
- **Known deviations called out in the prompt:**
  - Thinking blocks: implemented + tested.
  - `--strip-tools` boolean parsing: fixed + tested (uses `config.defaultPreset` when boolean true).
  - Test count: matches the stated 81 tests.

### Primary misalignments (worth fixing)

- Clone registration behavior with `-o` (High)
- `occ list` not honoring `stateDirectory` config (High)
- `toolCallsPreserved` semantics (Medium)
- Error output format consistency and stderr/stdout contract (Medium)
- Current-session auto-detect index-first behavior vs “most-recently-modified file” heuristic (Medium)

---

## Code Quality (Architecture, Readability, Maintainability)

### Strengths

- The repo closely mirrors the tech design’s intended structure, making it easy to reason about and test.
- `io/session-file-writer.ts` and `io/session-index-writer.ts` use temp + rename atomic patterns consistently.
- The tool removal algorithm is broken into testable helpers (classification, truncation).

### Maintainability opportunities

- **Duplicated command error handling:** Error formatting + hints are repeated across commands. A shared `formatError(...)` helper would reduce drift and keep behavior consistent.
- **Performance footgun:** `removeToolCalls` uses `allTurns.find(...)` per message (O(n²)). For large sessions this can be slow; a precomputed index (e.g., messageIndex → turn) would make it O(n).
- **Schema drift in truncation:** Storing `toolCall.arguments` as a string is deliberate and tested, but it increases integration risk unless OpenClaw’s replay path is tolerant of non-object `arguments`.

---

## Error Handling Review

- **Good:** Custom `OccError` hierarchy exists; atomic writes and backups reduce risk of corrupting sessions.
- **Needs work:** Some command-level error handling:
  - doesn’t honor resolved output format,
  - prints JSON errors to stdout (possibly contradicting docs/design),
  - references a non-existent flag in hints.

---

## Test Coverage Review

### Strengths

- Strong algorithm coverage, including thinking block removal and truncation markers.
- Good filesystem mocking strategy via `memfs` at the `node:fs/promises` boundary.
- Many “entry point” tests exist by calling `*.run(...)` on `citty` commands.

### Gaps (tests that would catch current spec misalignments)

- Clone: `-o` registers unless `--no-register`
- List: honors configured `stateDirectory` from config file (not just env var)
- Errors: config `outputFormat: "json"` drives JSON errors without requiring `--json`
- Edit: updates `sessions.json` timestamp after edit
- Current-session detection: behavior when index is stale vs file mtimes

---

## Edge Cases / Potential Bugs

- **Messages before first user turn:** Turn boundaries start at the first `user` message. Any assistant/tool content before the first user message is not assigned to a turn and will not be tool-stripped.
- **Tool results without tool calls:** Turns are considered “with tools” based on `toolCall` blocks, not `toolResult` messages. A corrupted transcript could behave unexpectedly.
- **Cross-platform path handling:** `createBackup` extracts sessionId by splitting on `/` (works on Unix paths, not Windows).
- **`occ edit` without `--strip-tools`:** Currently performs a backup + rewrite even though no transformations are requested (may be surprising; spec is silent).

---

## What’s Done Well

- Great alignment between the documented architecture and the implemented folder/module structure.
- Safe operational posture: backups + atomic writes + conservative removal of dangling references.
- Agent-centric UX: quickstart, presets, human + JSON output, clear stats.
- High-quality test suite: fast, deterministic, good fixture generators.

---

## What Could Be Better (Constructive)

- Tighten the remaining spec mismatches (clone registration, list stateDir propagation, stats semantics).
- Normalize output/error behavior across commands (one contract, consistently applied).
- Decide on and document the “thinking block” rule (always strip when `--strip-tools` requested vs conditional).
- Bring the repo back to “green checks” (`npm run check`) to reduce contributor friction.

---

## Recommendations (Actionable Next Steps)

1) Fix clone index registration for `-o` (or document the exception) + add a test.
2) Correct `toolCallsPreserved` semantics (or rename to reflect overlap) + update tests/output text.
3) Make `outputFormat` consistent on both success and error paths; decide stdout/stderr JSON contract and implement across all commands.
4) Thread `config.stateDirectory` through `occ list` code paths (agent discovery + index read) + add a config-file-based test.
5) Call `updateSessionTimestamp` after successful edits.
6) Revisit “current session” auto-detection: prefer file mtimes or validate index staleness.
7) Re-evaluate whether truncated `toolCall.arguments` must remain an object for replay stability.
8) Run Biome formatting/import organization and keep `npm run check` passing in CI.
9) Optimize `removeToolCalls` turn lookup to avoid O(n²) behavior on large transcripts.

---

## Open Questions / Risk Items

- Is OpenClaw (and the Anthropic replay path) tolerant of `toolCall.arguments` being a string after truncation?
- Should thinking blocks be removed whenever `--strip-tools` is requested, even if there are zero tool calls?
- Is `sessions.json` authoritative for “current session,” or should file mtimes always win?

