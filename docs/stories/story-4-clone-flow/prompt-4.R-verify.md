# Prompt 4.R: Clone Flow — Verification

## Context

**Story 4** implemented the clone command.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Role:** You are a verifier. Check clone implementation against all requirements.

## Verification Checklist

### 1. Test Results

```bash
npm test -- --reporter=verbose
```

**Expected:** 38 tests pass (8 algorithm + 19 edit + 11 clone)

Verify each clone test:

| TC | Test | Expected |
|----|------|----------|
| TC-4.1a | new UUID | Different from source, valid UUID format |
| TC-4.2a | text preserved | User messages unchanged |
| TC-4.3a | clone metadata | Header has clonedFrom, clonedAt |
| TC-4.4a | no partial | No file on failure |
| TC-4.5a | custom path | File at specified location |
| TC-4.6a | JSON complete | All CloneResult fields |
| TC-4.7a | no stripping | messagesOriginal = messagesCloned |
| TC-4.8a | partial ID | Resolves partial to full |
| TC-4.9a | index updated | New entry in sessions.json |
| TC-4.10a | no-register | sessions.json unchanged |
| TC-7.3a | JSON fields | All required fields present |

### 2. TypeScript Compilation

```bash
npm run typecheck
```

**Expected:** Exit code 0, no errors.

### 3. Clone Metadata

Verify cloned session header contains:
- `id`: New UUID (not source ID)
- `clonedFrom`: Source session ID
- `clonedAt`: ISO 8601 timestamp

### 4. UUID Format

Verify generated session IDs match UUID v4 format:
```
xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
```

### 5. Index Registration

Verify:
- Default: New session added to sessions.json
- With `--no-register`: sessions.json unchanged
- With `-o /custom/path`: sessions.json unchanged (custom paths not registered)

### 6. Atomic Operations

Verify:
- Temp file written first
- Renamed to target (atomic)
- No partial file on failure

### 7. Content Preservation

Verify without `--strip-tools`:
- All messages preserved
- All tool calls preserved
- Only session ID changes

### 8. Output Format

Verify human output includes:
```
✓ Session cloned: <source> → <new>
  Messages: N → M
  Tool calls: X removed, Y truncated, Z preserved
  Size: X KB → Y KB (Z% reduction)
  Resume: openclaw resume <newId>
```

## Verification Commands

```bash
# Run all tests
npm test

# Run only clone tests
npm test -- --grep "clone-command"

# Typecheck
npm run typecheck
```

## Pass Criteria

- [ ] All 38 tests pass
- [ ] No TypeScript errors
- [ ] Clone metadata correct
- [ ] UUID format valid
- [ ] Index registration correct
- [ ] Atomic operations verified

## Fail Actions

If verification fails:
1. Document which checks failed
2. Return to Green phase to fix
