# Prompt 3.R: Edit Flow — Verification

## Context

**Story 3** implemented the complete edit flow with backup management.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Role:** You are a verifier. Check the edit implementation against all requirements.

## Verification Checklist

### 1. Test Results

```bash
npm test -- --reporter=verbose
```

**Expected:** 27 tests pass (8 algorithm + 19 edit)

Verify each edit test:

| TC | Test | Expected |
|----|------|----------|
| TC-3.1a | modifies in place | Same file path, different content |
| TC-3.2a | backup created | Backup exists with original content |
| TC-3.3a | text preserved | User messages unchanged |
| TC-3.4a | failed edit safe | Original unchanged on failure |
| TC-3.5a | JSON complete | All EditResult fields present |
| TC-3.6a | partial ID | Finds session from partial |
| TC-3.7a | resumable | Session ID unchanged in file |
| TC-3.8a | auto-detect | Finds most recent session |
| TC-3.8b | auto-detect fails | Throws when no sessions |
| TC-6.1a | backup created | File exists |
| TC-6.2a | monotonic numbers | .backup.1, .backup.2, etc. |
| TC-6.5a | rotation at 5 | Deletes oldest when > 5 |
| TC-6.5b | under limit | Accumulates without deletion |
| TC-7.1a | human output | Formatted text |
| TC-7.2a | required fields | ID, stats, backup path |
| TC-7.4a | verbose | Extra detail shown |
| TC-7.5a | exit 0 | Success returns 0 |
| TC-7.5b | exit non-zero | Failure returns non-zero |
| TC-7.6a | actionable errors | Includes resolution hints |

### 2. TypeScript Compilation

```bash
npm run typecheck
```

**Expected:** Exit code 0, no errors.

### 3. Backup Integrity

Verify backup manager:
- Backup contains exact original content
- Monotonic numbering: 1, 2, 3, ... (not random)
- Rotation deletes oldest first
- Max 5 backups maintained

### 4. Atomic Operations

Verify edit executor:
- Backup created BEFORE any modification
- Temp file written, then renamed (atomic)
- On failure, original file unchanged
- On failure, backup still exists (if created)

### 5. Session ID Preservation

Verify that after edit:
- Session header ID unchanged
- File path unchanged
- Session remains loadable by OpenClaw

### 6. Output Format

Verify human output includes:
```
✓ Session edited: <sessionId>
  Messages: N → M (X% reduction)
  Tool calls: X removed, Y truncated, Z preserved
  Size: X KB → Y KB (Z% reduction)
  Backup: <path>
```

Verify JSON output matches EditResult interface exactly.

### 7. Preset Resolution

Verify presets:
- `default`: keep 20, truncate 50%
- `aggressive`: keep 10, truncate 50%
- `extreme`: keep 0, remove all

### 8. Error Handling

Verify error messages include:
- What failed (session not found, write error, etc.)
- Resolution hint (use 'occ list', check permissions, etc.)

## Verification Commands

```bash
# Run all tests
npm test

# Run only edit tests
npm test -- --grep "edit-command"

# Typecheck
npm run typecheck
```

## Pass Criteria

- [ ] All 27 tests pass
- [ ] No TypeScript errors
- [ ] Backup rotation correct
- [ ] Atomic operations verified
- [ ] Session ID preserved
- [ ] Output formats correct
- [ ] Error messages actionable

## Fail Actions

If verification fails:
1. Document which checks failed
2. Note specific test failures
3. Return to Green phase to fix
