# Prompt 5.R: Support Commands — Verification

## Context

**Story 5** implemented list, info, and restore commands.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Role:** Verifier. Check all support commands against requirements.

## Verification Checklist

### 1. Test Results

```bash
npm test -- --reporter=verbose
```

**Expected:** 64 tests pass

| TC | Test | Expected |
|----|------|----------|
| TC-1.1a | displays all | All sessions shown |
| TC-1.2a | sorted by recency | Newest first |
| TC-1.3a | required fields | ID, time, project path visible |
| TC-1.4a | limit flag | Respects -n |
| TC-1.5a | JSON parseable | Valid JSON array |
| TC-1.9a | missing agent error | Lists available agents |
| TC-2.1a | displays stats | Statistics shown |
| TC-2.2a | counts accurate | Matches actual |
| TC-2.3a | token estimate | Reasonable estimate |
| TC-2.4a | file size | Human-readable size |
| TC-2.5a | JSON complete | All fields present |
| TC-2.6a | invalid ID error | Error thrown |
| TC-2.7a | empty session | Zero counts, no crash |
| TC-6.3a | restore works | Original content restored |
| TC-6.4a | no backup error | Throws RestoreError |

### 2. TypeScript Compilation

```bash
npm run typecheck
```

**Expected:** Exit code 0.

### 3. List Command

Verify:
- Sessions sorted newest first
- Relative time formatting ("2 hours ago", "3 days ago")
- Session ID truncation for display
- Limit flag works
- JSON output is valid array

### 4. Info Command

Verify:
- Message counts correct (user, assistant, toolResult)
- Tool call counts correct
- Token estimation reasonable (~4 chars/token)
- File size in human format
- Empty session shows zeros (not error)

### 5. Restore Command

Verify:
- Finds highest-numbered backup
- Restores content exactly
- Throws RestoreError when no backup
- Original session replaced (not appended)

### 6. Error Handling

Verify:
- Missing session → SessionNotFoundError
- Missing agent → AgentNotFoundError with available list
- No backup → RestoreError with message

## Verification Commands

```bash
# All tests
npm test

# Support command tests only
npm test -- --grep "list-command|info-command|restore-command"

# Typecheck
npm run typecheck
```

## Pass Criteria

- [ ] All 64 tests pass
- [ ] No TypeScript errors
- [ ] List formatting correct
- [ ] Info statistics accurate
- [ ] Restore recovers correctly
- [ ] Error messages actionable

## Fail Actions

If verification fails:
1. Document failures
2. Return to Green phase to fix
