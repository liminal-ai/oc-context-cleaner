# Feature: oc-context-cleaner

This specification defines the complete requirements for oc-context-cleaner, a CLI tool that edits or clones OpenClaw session transcripts with intelligent tool call stripping. Edit-in-place is the primary mode; clone is a fallback. It serves as the source of truth for the Tech Lead's design work.

---

## User Profile

**Primary User:** OpenClaw agent (e.g., Molt) or human operator

**Context:** During a long-running session when context pressure builds, or periodically every ~10 turns to maintain headroom. The agent or operator needs to reduce context consumption without losing session continuity.

**Mental Model:** "I'm running out of context space. I need to clean up old tool calls so I can keep working without losing who I am or what we've been doing."

**Key Constraint:** Must be invocable by the agent itself via CLI. The agent needs to self-maintain without human intervention for routine cleanup.

### User Story

As an OpenClaw agent or operator,
I want to clean up my current session by stripping old tool calls,
so that I can continue working with reduced context pressure while preserving my identity and recent history.

---

## Scope

### In Scope

oc-context-cleaner delivers a CLI tool for context-aware session cleaning. The tool reduces context consumption by intelligently stripping tool calls based on recency, while preserving session structure and identity continuity.

**Primary mode (edit):** Modify the current session in place, with automatic backup before editing. The agent continues in the same session with reduced context.

**Fallback mode (clone):** Create a new session from an existing one. Used when edit isn't viable or when archiving is desired.

Core capabilities:
- Edit sessions in place with automatic backup (primary)
- Clone sessions to new files (fallback/alternative)
- Strip tool calls based on preset configurations (default, aggressive, extreme)
- Preserve message structure, identity references, and session metadata
- List available sessions with metadata for discovery
- Analyze sessions before cleaning (turn count, tool calls, size)
- Dual output format: human-readable and JSON for programmatic use

### Out of Scope

- Conversation history compression/summarization (future feature)
- History smoothing—grammar, spelling, whitespace normalization (future feature)
- Automatic/scheduled triggering (manual CLI invocation only for this feature)
- Patching into OpenClaw core (future: configurable params in OpenClaw itself)
- ~~Thinking block removal (OpenClaw doesn't have thinking blocks like Claude Code)~~ **DEFECT:** Research gap — OpenClaw sessions DO contain thinking blocks. Anthropic API rejects them on replay. Resolved during implementation: thinking blocks are now stripped alongside tool calls.
- Memory database synchronization (future: sync memory.db after transcript modification)

### Assumptions

| ID | Assumption | Status | Owner | Notes |
|----|------------|--------|-------|-------|
| A1 | OpenClaw stores sessions in `~/.clawdbot/agents/{agentId}/sessions/` | Validated | Tech Lead | Confirmed via tech research (was ~/.openclaw/) |
| A2 | Session transcripts are JSONL format (differs from Claude Code) | Validated | Tech Lead | Uses `toolCall`/`toolResult` not `tool_use`/`tool_result`; linear not tree |
| A3 | Session metadata lives in agent directory | Validated | Tech Lead | sessions.json in sessions dir |
| A4 | Tool calls are embedded in assistant content arrays | Validated | Tech Lead | `{type: "toolCall"}` in content array |
| A5 | Tool results are separate messages linked by ID | Validated | Tech Lead | `{role: "toolResult", toolCallId}` references toolCall.id |
| A6 | Agents can invoke CLI commands during sessions | Validated | — | Standard bash access |
| A7 | OpenClaw reloads session changes via cache invalidation | Validated | Tech Lead | 45s TTL + mtime check; edit-in-place confirmed viable |

---

## User Flows

### Flow 1: Edit Session in Place (Primary)

The primary flow—agent edits current session in place with automatic backup.

1. User invokes `occ edit <sessionId> --strip-tools` (or `occ edit --strip-tools` to auto-detect current session)
2. System locates session file (by ID or auto-detection) in agent's sessions directory
3. System creates backup of current session (e.g., `{sessionId}.backup.jsonl`)
4. System parses JSONL transcript
5. System identifies turns containing tool calls
6. System applies preset rules: keep recent N turns-with-tools at full fidelity, truncate next N, remove oldest
7. System ensures no dangling tool references (repairs or removes orphaned calls)
8. System writes modified content back to original session file
9. System updates session metadata (modification timestamp)
10. System outputs result with backup location
11. Agent continues in same session with reduced context (reload mechanism TBD in Tech Design)

### Flow 2: Clone Session (Fallback/Alternative)

Secondary flow—create new session when edit isn't viable or archiving is desired.

1. User invokes `occ clone <sessionId> --strip-tools`
2. System locates session file in agent's sessions directory
3. System parses JSONL transcript
4. System identifies turns containing tool calls
5. System applies preset rules: keep recent N turns-with-tools at full fidelity, truncate next N, remove oldest
6. System ensures no dangling tool references (repairs or removes orphaned calls)
7. System generates new session ID (UUID)
8. System writes new JSONL file with updated session ID
9. System updates session index with new entry
10. System outputs result (human-readable or JSON based on flags)

### Flow 3: List Available Sessions

Discovery flow—find session IDs before cleaning.

1. User invokes `occ list`
2. System reads session index from agent directory
3. System displays sessions sorted by recency (most recent first)
4. Each entry shows: session ID (truncated), timestamp, project path (if available)
5. User identifies target session for editing/cloning

### Flow 4: Analyze Session Before Cleaning

Investigation flow—understand session composition before deciding on preset.

1. User invokes `occ info <sessionId>`
2. System locates and parses session file
3. System analyzes: turn count, message count, tool call count, file size
4. System estimates token count (using character-based heuristic per ccs-cloner approach)
5. System outputs analysis (human-readable or JSON)
6. User decides which preset to use based on analysis

### Flow 5: Clone with Custom Output Path

Backup/archival flow—save clone to specific location.

1. User invokes `occ clone <sessionId> --strip-tools -o /path/to/backup.jsonl`
2. System follows Flow 2 steps 2-7
3. System writes to specified path instead of default location
4. System still registers in session index (unless `--no-register` flag)

### Flow 6: Restore from Backup

Recovery flow—undo an edit by restoring backup.

1. User invokes `occ restore <sessionId>`
2. System locates backup file for session
3. System replaces current session with backup
4. System outputs confirmation

### Flow 7: Error Recovery

When something goes wrong.

1. User invokes edit or clone command
2. System encounters error (session not found, parse error, write failure)
3. System outputs error with actionable message
4. System exits with non-zero status code
5. No partial files written (atomic operation)
6. For edit: backup remains intact if created before failure

---

## Acceptance Criteria

### 1. Session Discovery & Listing

The list command enables users to find session IDs without knowing the file system structure. This is essential for agents who need to self-invoke the tool.

- **AC-1.1:** `occ list` displays all sessions from the active agent's session index
- **AC-1.2:** Sessions are sorted by modification time, most recent first
- **AC-1.3:** Each session entry displays: truncated ID, relative timestamp, project path (if available)
- **AC-1.4:** `occ list -n <count>` limits output to specified number of sessions
- **AC-1.5:** `occ list --json` outputs session list as JSON array
- **AC-1.6:** Partial session ID matching supported (like ccs-cloner)
- **AC-1.7:** Tool auto-detects active agent from OpenClaw environment (env var or process context)
- **AC-1.8:** `--agent <id>` flag overrides auto-detection to target specific agent
- **AC-1.9:** When agent cannot be determined, tool displays actionable error listing available agents

### 2. Session Analysis

The info command helps users understand session composition before deciding how aggressively to strip.

- **AC-2.1:** `occ info <sessionId>` displays session statistics
- **AC-2.2:** Statistics include: total messages, user messages, assistant messages, tool calls, tool results
- **AC-2.3:** Statistics include: estimated total tokens (character-based heuristic)
- **AC-2.4:** Statistics include: file size
- **AC-2.5:** `occ info --json` outputs statistics as JSON object
- **AC-2.6:** Info command fails gracefully if session ID not found, with actionable error message
- **AC-2.7:** Empty session (no messages) handled gracefully with appropriate output

### 3. Edit Operation (Primary)

The edit command modifies a session in place with automatic backup, allowing the agent to continue in the same session.

- **AC-3.1:** `occ edit <sessionId> --strip-tools` modifies the session file in place
- **AC-3.2:** Before editing, system creates backup at predictable location (e.g., `{sessionId}.backup.jsonl`)
- **AC-3.3:** Edited session preserves all message content (text, images) except stripped tool calls
- **AC-3.4:** Edit operation is atomic—original file unchanged if operation fails
- **AC-3.5:** `--json` outputs edit result as JSON with statistics and backup location
- **AC-3.6:** Partial session ID matching supported (like ccs-cloner)
- **AC-3.7:** Session remains resumable after edit (same session ID)
- **AC-3.8:** `occ edit` (without session ID) auto-detects current session for agent self-invocation

### 4. Clone Operation (Fallback)

The clone command creates a new session from an existing one. Used when edit isn't viable or for archiving.

- **AC-4.1:** `occ clone <sessionId>` creates a new session file with new UUID
- **AC-4.2:** Cloned session preserves all message content (text, images) except stripped tool calls
- **AC-4.3:** Cloned session header contains: new sessionId, original sessionId reference, clone timestamp
- **AC-4.4:** Clone operation is atomic—no partial files on failure
- **AC-4.5:** `-o <path>` writes to specified path instead of default location
- **AC-4.6:** `--json` outputs clone result as JSON with new session ID and statistics
- **AC-4.7:** Clone without `--strip-tools` creates exact copy with new ID (baseline behavior)
- **AC-4.8:** Partial session ID matching supported (like ccs-cloner)
- **AC-4.9:** Clone updates session index with new entry
- **AC-4.10:** `--no-register` skips session index update (for backup/export use cases)

### 5. Tool Call Stripping

Tool stripping is the core value—reducing context consumption while preserving recent tool context. For technical reasons (avoiding degradation over repeated operations), stripping operates on turn counts rather than percentages.

- **AC-5.1:** `--strip-tools` applies default preset (keep last 20 turns-with-tools, truncate oldest 50% of those)
- **AC-5.2:** `--strip-tools=aggressive` applies aggressive preset (keep last 10 turns-with-tools, truncate oldest 50%)
- **AC-5.3:** `--strip-tools=extreme` removes all tool calls and results
- **AC-5.4:** After stripping, transcript contains no dangling tool_use references that would cause OpenClaw parse errors
- **AC-5.5:** Most recent turns-with-tools are preserved at full fidelity
- **AC-5.6:** Truncation reduces tool call arguments and results to 2 lines or 120 characters, whichever is shorter (per ccs-cloner)
- **AC-5.7:** Removed tool calls are deleted entirely (both call and corresponding result)
- **AC-5.8:** Session with no tool calls processes without modification (no-op for stripping)

### 6. Backup & Restore

Edit operations create backups for recovery.

- **AC-6.1:** Edit creates backup before modifying session
- **AC-6.2:** Backups are stored at `{sessionId}.backup.{n}.jsonl` with monotonic numbering (newest backup gets next available n; when max 5 reached, oldest is deleted)
- **AC-6.3:** `occ restore <sessionId>` restores session from most recent backup
- **AC-6.4:** Restore fails gracefully if no backup exists
- **AC-6.5:** Multiple backups retained with rotation (max 5, oldest deleted when limit exceeded)

### 7. Output & Usability

Output design must work for both humans and agents invoking the tool.

- **AC-7.1:** Default output is human-readable with clear formatting
- **AC-7.2:** Human output includes: session ID, statistics, backup location (for edit), resume command (clone only—edit continues in same session)
- **AC-7.3:** `--json` output includes all information in parseable structure
- **AC-7.4:** `--verbose` shows detailed statistics
- **AC-7.5:** Exit code 0 on success, non-zero on failure
- **AC-7.6:** Error messages are actionable (what went wrong, how to fix)
- **AC-7.7:** `--help` displays usage information
- **AC-7.8:** `--quickstart` displays condensed agent-friendly help (~250 tokens, following ccs-cloner pattern: when to use, presets, common commands)

### 8. Configuration

Support for customization without requiring flags every invocation.

- **AC-8.1:** Tool reads config from standard locations (following ccs-cloner pattern)
- **AC-8.2:** Config can define custom presets with turn counts and truncation settings
- **AC-8.3:** Environment variables override config file values
- **AC-8.4:** CLI flags override environment variables

---

## Data Contracts

### Key Concepts

**Turn:** A turn is one user input through the final assistant response before the next user input. This matches ccs-cloner's definition. A "turn with tools" is any turn where the assistant used at least one tool.

### Edit Result (JSON output)

```typescript
interface EditResult {
  success: boolean;
  mode: "edit";
  sessionId: string;
  backupPath: string;

  statistics: {
    messagesOriginal: number;
    messagesAfter: number;
    toolCallsOriginal: number;
    toolCallsRemoved: number;
    toolCallsTruncated: number;
    toolCallsPreserved: number;
    sizeOriginal: number;               // bytes
    sizeAfter: number;                  // bytes
    reductionPercent: number;
  };
}
```

### Clone Result (JSON output)

```typescript
interface CloneResult {
  success: boolean;
  mode: "clone";
  sourceSessionId: string;
  clonedSessionId: string;
  clonedSessionPath: string;

  statistics: {
    messagesOriginal: number;
    messagesCloned: number;
    toolCallsOriginal: number;
    toolCallsRemoved: number;
    toolCallsTruncated: number;
    toolCallsPreserved: number;
    sizeOriginal: number;               // bytes
    sizeCloned: number;                 // bytes
    reductionPercent: number;
  };

  resumeCommand?: string;               // How to resume the cloned session
}
```

### Preset Configuration

```typescript
/**
 * Tool stripping uses turn-based counting (not percentages) to avoid
 * degradation over repeated clones. A "turn" is one user input through
 * the final assistant response before the next user input.
 */
interface ToolStripPreset {
  name: string;
  /** How many turns-with-tools to keep (newest first) */
  keepTurnsWithTools: number;
  /** Percentage of kept turns to truncate (oldest portion of kept, 0-100) */
  truncatePercent: number;
}

// Built-in presets (following ccs-cloner's model)
const DEFAULT_PRESET: ToolStripPreset = {
  name: "default",
  keepTurnsWithTools: 20,
  truncatePercent: 50,    // oldest 10 of 20 get truncated
};

const AGGRESSIVE_PRESET: ToolStripPreset = {
  name: "aggressive",
  keepTurnsWithTools: 10,
  truncatePercent: 50,    // oldest 5 of 10 get truncated
};

const EXTREME_PRESET: ToolStripPreset = {
  name: "extreme",
  keepTurnsWithTools: 0,  // all tool calls removed
  truncatePercent: 0,
};
```

### Session and Message Types

Data contracts for session entries and message formats will be verified against OpenClaw's actual implementation during Tech Design. The JSONL structure is similar to Claude Code (validated via codebase review), but exact field names and type definitions will be confirmed and documented in the Tech Design phase.

Key shapes to verify:
- Session index entry structure
- JSONL line item structure
- Tool call content block format
- Tool result message format

---

## Test Conditions

### 1. Session Discovery & Listing

**TC-1.1a: List displays all sessions**
- **Traces to:** AC-1.1
- **Given:** Agent directory contains session index with 5 session entries
- **When:** User runs `occ list`
- **Then:** Output displays all 5 sessions

**TC-1.2a: Sessions sorted by recency**
- **Traces to:** AC-1.2
- **Given:** Sessions with modification times [oldest, middle, newest]
- **When:** User runs `occ list`
- **Then:** Sessions display in order [newest, middle, oldest]

**TC-1.3a: Session entry displays required fields**
- **Traces to:** AC-1.3
- **Given:** Session with known ID and timestamp
- **When:** User runs `occ list`
- **Then:** Entry shows truncated ID, relative time (e.g., "2 hours ago")

**TC-1.4a: Limit flag restricts output**
- **Traces to:** AC-1.4
- **Given:** 10 sessions exist
- **When:** User runs `occ list -n 3`
- **Then:** Only 3 sessions displayed

**TC-1.5a: JSON output is parseable**
- **Traces to:** AC-1.5
- **Given:** Sessions exist
- **When:** User runs `occ list --json`
- **Then:** Output is valid JSON array with session objects

**TC-1.6a: Partial ID matching works**
- **Traces to:** AC-1.6
- **Given:** Session with ID "abc123-def456-..."
- **When:** User runs `occ info abc123`
- **Then:** Session is found and displayed

**TC-1.6b: Ambiguous partial ID fails gracefully**
- **Traces to:** AC-1.6
- **Given:** Multiple sessions starting with "abc"
- **When:** User runs `occ info abc`
- **Then:** Error message lists matching sessions

**TC-1.7a: Agent auto-detected from environment**
- **Traces to:** AC-1.7
- **Given:** Tool is run within an OpenClaw agent context
- **When:** User runs `occ list` without --agent flag
- **Then:** Sessions from the active agent are listed

**TC-1.8a: Agent flag overrides auto-detection**
- **Traces to:** AC-1.8
- **Given:** Active agent is "molt" but user specifies --agent other-agent
- **When:** User runs `occ list --agent other-agent`
- **Then:** Sessions from "other-agent" are listed

**TC-1.9a: Missing agent context shows actionable error**
- **Traces to:** AC-1.9
- **Given:** Tool is run outside OpenClaw context and no --agent flag
- **When:** User runs `occ list`
- **Then:** Error message explains agent context required
- **And:** Lists available agents if discoverable

### 2. Session Analysis

**TC-2.1a: Info displays session statistics**
- **Traces to:** AC-2.1
- **Given:** Valid session ID
- **When:** User runs `occ info <sessionId>`
- **Then:** Statistics are displayed

**TC-2.2a: Message counts are accurate**
- **Traces to:** AC-2.2
- **Given:** Session with 10 user messages, 10 assistant messages, 8 tool calls, 8 tool results
- **When:** User runs `occ info <sessionId>`
- **Then:** Counts displayed match actual content (exact structure per JSONL format verified in Tech Design)

**TC-2.3a: Token estimation displayed**
- **Traces to:** AC-2.3
- **Given:** Session with content
- **When:** User runs `occ info <sessionId>`
- **Then:** Output includes estimated token count
- **And:** Estimation uses character-based heuristic (per ccs-cloner)

**TC-2.4a: File size displayed**
- **Traces to:** AC-2.4
- **Given:** Session file exists
- **When:** User runs `occ info <sessionId>`
- **Then:** Output includes file size in human-readable format (e.g., "2.3 MB")

**TC-2.5a: Info JSON output is complete**
- **Traces to:** AC-2.5
- **Given:** Valid session
- **When:** User runs `occ info <sessionId> --json`
- **Then:** Output is valid JSON containing all statistics fields

**TC-2.6a: Error on invalid session ID**
- **Traces to:** AC-2.6
- **Given:** Session ID that doesn't exist
- **When:** User runs `occ info nonexistent`
- **Then:** Error message indicates session not found
- **And:** Exit code is non-zero

**TC-2.7a: Empty session handled**
- **Traces to:** AC-2.7
- **Given:** Session file exists but has no messages
- **When:** User runs `occ info <sessionId>`
- **Then:** Output shows zero counts (not error)

### 3. Edit Operation

**TC-3.1a: Edit modifies session in place**
- **Traces to:** AC-3.1
- **Given:** Valid session with tool calls
- **When:** User runs `occ edit <sessionId> --strip-tools`
- **Then:** Original session file is modified
- **And:** Session ID remains the same

**TC-3.2a: Edit creates backup before modifying**
- **Traces to:** AC-3.2
- **Given:** Valid session
- **When:** User runs `occ edit <sessionId> --strip-tools`
- **Then:** Backup file exists at predictable location
- **And:** Backup contains original session content

**TC-3.3a: Edit preserves text content**
- **Traces to:** AC-3.3
- **Given:** Session with text messages
- **When:** User runs `occ edit <sessionId> --strip-tools`
- **Then:** Edited session contains identical text content (except stripped tools)

**TC-3.4a: Failed edit leaves original unchanged**
- **Traces to:** AC-3.4
- **Given:** Edit operation that will fail mid-process
- **When:** Edit fails
- **Then:** Original session file unchanged
- **And:** Backup file remains if created

**TC-3.5a: Edit JSON output is complete**
- **Traces to:** AC-3.5
- **Given:** Successful edit operation
- **When:** User runs `occ edit <sessionId> --strip-tools --json`
- **Then:** Output is valid JSON matching EditResult interface
- **And:** Includes statistics and backup path

**TC-3.6a: Partial ID matching works for edit**
- **Traces to:** AC-3.6
- **Given:** Session with ID "abc123-def456-..."
- **When:** User runs `occ edit abc123 --strip-tools`
- **Then:** Session is found and edited

**TC-3.7a: Session resumable after edit**
- **Traces to:** AC-3.7
- **Given:** Active session that was just edited
- **When:** Agent continues working
- **Then:** Session ID unchanged
- **And:** OpenClaw can continue without restart (mechanism per Tech Design)

**TC-3.8a: Edit auto-detects current session**
- **Traces to:** AC-3.8
- **Given:** Agent is running in an OpenClaw session
- **When:** User runs `occ edit --strip-tools` (no session ID)
- **Then:** Current session is detected and edited

**TC-3.8b: Auto-detect fails gracefully outside session**
- **Traces to:** AC-3.8
- **Given:** Tool is run outside an OpenClaw session context
- **When:** User runs `occ edit --strip-tools` (no session ID)
- **Then:** Error message indicates session ID required or detection failed

### 4. Clone Operation

**TC-4.1a: Clone creates new session with new UUID**
- **Traces to:** AC-4.1
- **Given:** Valid source session
- **When:** User runs `occ clone <sessionId>`
- **Then:** New file created with different UUID

**TC-4.2a: Clone preserves text content**
- **Traces to:** AC-4.2
- **Given:** Session with text messages
- **When:** User runs `occ clone <sessionId>`
- **Then:** Cloned session contains identical text content

**TC-4.3a: Clone header contains metadata**
- **Traces to:** AC-4.3
- **Given:** Source session
- **When:** User runs `occ clone <sessionId>`
- **Then:** Clone header contains new sessionId, clonedFrom, clonedAt

**TC-4.4a: Failed clone leaves no partial file**
- **Traces to:** AC-4.4
- **Given:** Clone operation that will fail
- **When:** Clone fails mid-operation
- **Then:** No partial file exists at output path

**TC-4.5a: Custom output path respected**
- **Traces to:** AC-4.5
- **Given:** Valid session
- **When:** User runs `occ clone <id> -o /tmp/backup.jsonl`
- **Then:** File created at /tmp/backup.jsonl

**TC-4.6a: Clone JSON output is complete**
- **Traces to:** AC-4.6
- **Given:** Successful clone operation
- **When:** User runs `occ clone <sessionId> --json`
- **Then:** Output is valid JSON matching CloneResult interface
- **And:** Includes new session ID, statistics, and resume command

**TC-4.7a: Clone without stripping preserves all content**
- **Traces to:** AC-4.7
- **Given:** Session with tool calls and text messages
- **When:** User runs `occ clone <id>` (no --strip-tools)
- **Then:** Cloned session contains identical content to original
- **And:** Only session ID differs

**TC-4.8a: Partial ID matching works for clone**
- **Traces to:** AC-4.8
- **Given:** Session with ID "abc123-def456-..."
- **When:** User runs `occ clone abc123`
- **Then:** Session is found and cloned

**TC-4.9a: Clone updates session index**
- **Traces to:** AC-4.9
- **Given:** Session index exists
- **When:** Clone completes successfully
- **Then:** Session index contains new entry with cloned session ID

**TC-4.10a: No-register flag skips index update**
- **Traces to:** AC-4.10
- **Given:** Valid session
- **When:** User runs `occ clone <id> --no-register`
- **Then:** Session index is not modified

### 5. Tool Call Stripping

**TC-5.1a: Default preset keeps last 20 turns-with-tools**
- **Traces to:** AC-5.1, AC-5.5
- **Given:** Session with 30 turns containing tool calls
- **When:** User runs `occ edit <id> --strip-tools`
- **Then:** Last 20 turns-with-tools are present
- **And:** First 10 turns-with-tools are removed

**TC-5.1b: Default preset truncates oldest 50% of kept turns**
- **Traces to:** AC-5.1, AC-5.6
- **Given:** Session with 30 turns containing tool calls
- **When:** User runs `occ edit <id> --strip-tools`
- **Then:** Turns 11-20 (oldest kept) are truncated
- **And:** Turns 21-30 (newest) are full fidelity

**TC-5.2a: Aggressive preset keeps last 10 turns-with-tools**
- **Traces to:** AC-5.2
- **Given:** Session with 20 turns containing tool calls
- **When:** User runs `occ edit <id> --strip-tools=aggressive`
- **Then:** Last 10 turns-with-tools are present
- **And:** First 10 turns-with-tools are removed
- **And:** Oldest 5 of kept turns are truncated

**TC-5.3a: Extreme preset removes all tool calls**
- **Traces to:** AC-5.3
- **Given:** Session with tool calls
- **When:** User runs `occ edit <id> --strip-tools=extreme`
- **Then:** Session contains no tool calls or tool results

**TC-5.4a: Edited session loads without errors**
- **Traces to:** AC-5.4
- **Given:** Session with tool calls, some in removal zone
- **When:** Edit completes
- **Then:** OpenClaw can load the edited session without parse errors
- **And:** No runtime errors from dangling tool references (exact constraints per Tech Design verification of OpenClaw's JSONL semantics)

**TC-5.6a: Truncation respects limits**
- **Traces to:** AC-5.6
- **Given:** Tool call with long arguments (500+ characters)
- **When:** Tool call is in truncation zone and edit runs
- **Then:** Arguments truncated to ≤120 characters or ≤2 lines
- **And:** Truncation marker added (e.g., "...")

**TC-5.7a: Removed tool calls deleted entirely**
- **Traces to:** AC-5.7
- **Given:** Session with tool calls in removal zone
- **When:** Edit completes
- **Then:** Both tool_use block and corresponding tool_result are removed
- **And:** No trace of removed tool calls remains in transcript

**TC-5.8a: No-tool session processes cleanly**
- **Traces to:** AC-5.8
- **Given:** Session with no tool calls
- **When:** User runs `occ edit <id> --strip-tools`
- **Then:** Edit succeeds with all messages preserved

### 6. Backup & Restore

**TC-6.1a: Backup created on edit**
- **Traces to:** AC-6.1
- **Given:** Valid session
- **When:** Edit operation runs
- **Then:** Backup file created before modification

**TC-6.2a: Backup uses monotonic numbering**
- **Traces to:** AC-6.2
- **Given:** Session with ID "abc123..." and existing backups at .backup.1, .backup.2
- **When:** Edit creates new backup
- **Then:** New backup is at `abc123....backup.3.jsonl`
- **And:** Previous backups (.backup.1, .backup.2) remain unchanged

**TC-6.3a: Restore recovers from backup**
- **Traces to:** AC-6.3
- **Given:** Session that was previously edited (backup exists)
- **When:** User runs `occ restore <sessionId>`
- **Then:** Session restored to pre-edit state

**TC-6.4a: Restore fails gracefully without backup**
- **Traces to:** AC-6.4
- **Given:** Session with no backup
- **When:** User runs `occ restore <sessionId>`
- **Then:** Error message indicates no backup exists
- **And:** Exit code is non-zero

**TC-6.5a: Backup rotation maintains max 5**
- **Traces to:** AC-6.5
- **Given:** Session has backups at .backup.1 through .backup.5
- **When:** User runs `occ edit <sessionId> --strip-tools`
- **Then:** New backup created at .backup.6
- **And:** Oldest backup (.backup.1) deleted
- **And:** Total backups remain at 5

**TC-6.5b: Backups accumulate up to limit**
- **Traces to:** AC-6.5
- **Given:** Session has backups at .backup.1, .backup.2, .backup.3
- **When:** User runs `occ edit <sessionId> --strip-tools`
- **Then:** New backup created at .backup.4
- **And:** All 4 backups retained (under limit)

### 7. Output & Usability

**TC-7.1a: Default output is human-readable**
- **Traces to:** AC-7.1
- **Given:** Successful edit or clone
- **When:** No --json flag
- **Then:** Output contains formatted text with labels

**TC-7.2a: Human output includes required fields**
- **Traces to:** AC-7.2
- **Given:** Successful edit operation
- **When:** Default (human) output displayed
- **Then:** Output includes session ID, statistics summary, and backup location
- **And:** Clone output additionally includes resume command

**TC-7.3a: JSON output is complete**
- **Traces to:** AC-7.3
- **Given:** Successful edit
- **When:** --json flag used
- **Then:** Output contains all fields from EditResult interface

**TC-7.5a: Success returns exit code 0**
- **Traces to:** AC-7.5
- **Given:** Valid edit operation
- **When:** Edit completes
- **Then:** Process exit code is 0

**TC-7.5b: Failure returns non-zero exit code**
- **Traces to:** AC-7.5
- **Given:** Invalid session ID
- **When:** Operation fails
- **Then:** Process exit code is non-zero

**TC-7.6a: Error messages are actionable**
- **Traces to:** AC-7.6
- **Given:** Session ID that doesn't exist
- **When:** User runs `occ edit nonexistent --strip-tools`
- **Then:** Error message explains what went wrong ("Session not found")
- **And:** Suggests resolution ("Use 'occ list' to see available sessions")

**TC-7.4a: Verbose flag shows detailed statistics**
- **Traces to:** AC-7.4
- **Given:** Successful edit operation
- **When:** User runs with --verbose flag
- **Then:** Output includes additional detail beyond default
- **And:** Shows per-turn breakdown or similar extended info

**TC-7.7a: Help flag shows usage**
- **Traces to:** AC-7.7
- **Given:** User runs `occ --help`
- **Then:** Usage information displayed

**TC-7.8a: Quickstart shows condensed help**
- **Traces to:** AC-7.8
- **Given:** User runs `occ --quickstart`
- **Then:** Agent-friendly condensed help displayed (~250 tokens)
- **And:** Includes: when to use, presets, common commands

### 8. Configuration

**TC-8.1a: Config read from standard location**
- **Traces to:** AC-8.1
- **Given:** Config file exists at standard location
- **When:** User runs any occ command
- **Then:** Config values are applied

**TC-8.2a: Custom preset from config applied**
- **Traces to:** AC-8.2
- **Given:** Config file defines custom preset "conservative" with keepTurnsWithTools: 30
- **When:** User runs `occ edit <id> --strip-tools=conservative`
- **Then:** Custom preset values applied (keeps 30 turns)

**TC-8.3a: Environment variable overrides config**
- **Traces to:** AC-8.3
- **Given:** Config file sets default preset to "aggressive"
- **And:** Environment variable OCC_PRESET=default
- **When:** User runs `occ edit <id> --strip-tools`
- **Then:** Default preset applied (env var wins)

**TC-8.4a: CLI flag overrides environment variable**
- **Traces to:** AC-8.4
- **Given:** Environment variable OCC_PRESET=default
- **When:** User runs `occ edit <id> --strip-tools=aggressive`
- **Then:** Aggressive preset applied (CLI flag wins)

---

## Technical Unknowns — RESOLVED

All technical unknowns have been resolved by Tech Lead research. Documented here for reference.

### Session Reload Mechanism ✅

**Resolution:** 45-second TTL cache with mtime invalidation. No file watcher needed—changes detected when cache expires. Edit-in-place confirmed viable.

### Session Continuity Behavior ✅

**Resolution:** Single active session per agent. Most-recently-modified file = current session.

### JSONL Format Verification ✅

**Resolution:** Format differs from Claude Code:
- Tool calls: `{type: "toolCall"}` (not `tool_use`)
- Tool results: `{role: "toolResult", toolCallId}` (not content block with `tool_result`)
- Linear transcript (no parent/child UUID tree)
- Session header: separate `{type: "session"}` entry

Algorithm logic from ccs-cloner transfers; field names differ. OpenClaw-specific types defined in Tech Design.

### Agent Directory Resolution ✅

**Resolution:**
- Directory: `~/.clawdbot/agents/{agentId}/sessions/`
- Default agent: "main"
- Override via `--agent` flag or `OPENCLAW_AGENT_DIR` env var

### Current Session Detection ✅

**Resolution:** Most-recently-modified .jsonl file heuristic:
```bash
ls -t ~/.clawdbot/agents/main/sessions/*.jsonl | head -1
```
Confirmed by Molt as the expected approach. `--session <id>` overrides when specified.

---

## Dependencies

Technical dependencies:

- OpenClaw installed and configured
- Node.js 18+ runtime
- File system access to agent sessions directory

Reference implementation:

- ccs-cloner provides patterns for CLI design, tool stripping algorithm, and output formatting

---

## Related Features

- **History Compression (future)** — Will add summarization of conversation history (not just tool stripping)
- **History Smoothing (future)** — Grammar, spelling, whitespace normalization
- **OpenClaw Integration (future)** — Embedding compression as configurable params in OpenClaw core
- **ccs-cloner** — Sister tool for Claude Code sessions; shares design philosophy and patterns

---

## Validation Checklist

### Content Completeness

- [x] User Profile has all four fields
- [x] User Flows cover all paths (edit, clone, list, info, restore, error)
- [x] Every AC can be verified as true/false
- [x] Every AC has at least one TC
- [x] TCs cover happy path, edge cases, and error handling
- [x] Scope boundaries are explicit
- [x] Assumptions documented with validation status and owners
- [x] Technical unknowns identified for Tech Design

### Self-Review

- [x] Read the spec fresh, as if someone else wrote it
- [x] Can explain why each AC matters to the primary user
- [x] Flows match how the user actually thinks about the task
- [x] Uses turns (not percentages) for tool stripping per ccs-cloner learnings
- [x] Defers implementation details to Tech Design appropriately
- [x] Edit as primary mode, clone as fallback clearly articulated
- [x] Agent resolution behavior specified (auto-detect, override, error handling)

### Tech Lead Validation

- [x] Data contract shapes realistic (OpenClaw-specific types defined in Tech Design)
- [x] Technical unknowns resolved (all 5 items investigated and documented)
- [x] Session reload mechanism determined (45s TTL + mtime invalidation)
- [x] Integration points clear (directory structure, session index, JSONL format)
- [x] ccs-cloner patterns applicable (algorithm transfers, field names differ)
