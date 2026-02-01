# Prompt 2.R: IO Layer — Verification

## Context

**Story 2** implemented the IO layer for session file operations.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Role:** You are a verifier. Check the IO implementation for correctness.

## Verification Checklist

### 1. TypeScript Compilation

```bash
npm run typecheck
```

**Expected:** Exit code 0, no errors.

### 2. Previous Tests Still Pass

```bash
npm test
```

**Expected:** All 8 tests still pass.

### 3. Atomic Write Pattern

Verify `session-file-writer.ts` and `session-index-writer.ts`:
- Use temp file with random UUID
- Write content to temp file
- Rename temp to target (atomic on POSIX)
- Clean up temp file on failure

### 4. Error Handling

Verify graceful handling of:
- Missing files (ENOENT) → return empty/default
- Missing directories → appropriate error
- Read errors → propagate with context

### 5. Session Discovery Logic

Verify `session-discovery.ts`:
1. Auto-detect returns most recently modified
2. Exact match works
3. Partial match works (unique → return, ambiguous → error)
4. Missing session → SessionNotFoundError
5. Missing agent → AgentNotFoundError with available list

### 6. Path Utilities

Verify `paths.ts`:
- `getStateDirectory()` respects `CLAWDBOT_STATE_DIR` env var
- `resolveAgentId()` respects `CLAWDBOT_AGENT_ID` env var
- Default agent is "main"
- Backup paths include monotonic number

### 7. File Paths

Verify path format:
- Sessions: `~/.clawdbot/agents/{agentId}/sessions/{sessionId}.jsonl`
- Index: `~/.clawdbot/agents/{agentId}/sessions/sessions.json`
- Backups: `~/.clawdbot/agents/{agentId}/sessions/{sessionId}.backup.{n}.jsonl`

## Verification Commands

```bash
# Typecheck
npm run typecheck

# Run existing tests
npm test

# Verify imports work
node -e "import('./dist/io/paths.js').then(m => console.log(m.getStateDirectory()))"
```

## Manual Verification

If you have access to a real OpenClaw installation:

```bash
# List session files
ls ~/.clawdbot/agents/main/sessions/*.jsonl

# Check index format
cat ~/.clawdbot/agents/main/sessions/sessions.json | head -20
```

## Pass Criteria

- [ ] `npm run typecheck` passes
- [ ] All 8 tests still pass
- [ ] Atomic write pattern implemented
- [ ] Error handling follows spec
- [ ] Path utilities respect environment

## Fail Actions

If verification fails:
1. Document which checks failed
2. Return to Green phase to fix
