# Prompt 1.R: Core Algorithm — Verification

## Context

**Story 1** implemented the core tool removal algorithm. This verification ensures correctness against the spec.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Role:** You are a verifier. Check that the implementation meets all requirements. Be pedantic.

## Verification Checklist

### 1. Test Results

```bash
npm test -- --reporter=verbose
```

**Expected:** All tests pass. Specifically verify:

| TC | Test | Expected Behavior |
|----|------|-------------------|
| TC-5.1a | default keeps 20 turns | 30 turns → 10 removed, 20 kept |
| TC-5.1b | truncates oldest 50% | Of 20 kept, 10 truncated |
| TC-5.2a | aggressive keeps 10 | 20 turns → 10 removed, 10 kept |
| TC-5.3a | extreme removes all | All tool calls removed |
| TC-5.4a | no dangling refs | All toolResult.toolCallId has matching toolCall.id |
| TC-5.6a | truncation limits | Arguments ≤120 chars or ≤2 lines |
| TC-5.7a | deleted entirely | Removed tools leave no trace |
| TC-5.8a | no-tool unchanged | Sessions without tools pass through |

### 2. TypeScript Compilation

```bash
npm run typecheck
```

**Expected:** Exit code 0, no errors.

### 3. Algorithm Correctness

Verify the classification logic in `classifyTurns`:

1. **Remove zone:** Oldest turns beyond keep limit
2. **Truncate zone:** Oldest N% of kept turns
3. **Preserve zone:** Newest turns at full fidelity

For default preset (keep=20, truncate=50%):
- 30 turns → remove 10, truncate 10, preserve 10
- 25 turns → remove 5, truncate 10, preserve 10
- 20 turns → remove 0, truncate 10, preserve 10
- 15 turns → remove 0, truncate 7, preserve 8

### 4. Edge Cases

Verify handling of:

1. **Empty session:** No messages → returns empty (with header)
2. **No tool calls:** All messages preserved unchanged
3. **All tool calls:** Extreme preset removes everything
4. **Single turn:** Works correctly
5. **Fewer turns than keep limit:** All preserved (some truncated per %)

### 5. Orphan Prevention

Verify that after processing:
- Every `toolResult` message has a `toolCallId` that matches a `toolCall.id` in the output
- No `toolCall` blocks exist without corresponding `toolResult`

### 6. Truncation Format

Verify truncated arguments:
- String length ≤ 120 characters (plus marker)
- Line count ≤ 2 lines
- Marker "..." appended when truncated
- Tool result uses "[truncated]" marker

### 7. Content Preservation

Verify that non-tool content is never modified:
- User messages unchanged
- Text blocks in assistant messages unchanged
- Only tool call arguments and tool results truncated

## Verification Commands

```bash
# Run all tests with coverage
npm test -- --coverage

# Check specific algorithm tests
npm test -- --grep "tool-call-remover"

# Typecheck
npm run typecheck
```

## Pass Criteria

- [ ] All 8+ tests pass
- [ ] No TypeScript errors
- [ ] Classification matches expected behavior
- [ ] No orphaned tool references possible
- [ ] Truncation respects limits
- [ ] Non-tool content unchanged

## Fail Actions

If verification fails:
1. Document which checks failed
2. Note specific discrepancies vs spec
3. Return to Green phase to fix
