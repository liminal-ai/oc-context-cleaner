# Prompt 6.R: Configuration — Verification

## Context

**Story 6** completed the CLI with configuration loading.

**Working Directory:** `/Users/leemoore/code/agent-cli-tools/oc-context-cleaner`

**Role:** Final verification. Check the complete CLI is ready for use.

## Verification Checklist

### 1. Test Results

```bash
npm test -- --reporter=verbose
```

**Expected:** All 63 tests pass.

| TC | Test | Expected |
|----|------|----------|
| TC-7.7a | help available | citty handles --help |
| TC-7.8a | quickstart | ~250 tokens, includes presets/commands |
| TC-8.1a | config location | Checks ~/.config/occ, etc. |
| TC-8.2a | custom preset | Custom presets work |
| TC-8.3a | env override | OCC_* env vars work |
| TC-8.4a | CLI override | Flags override env |

### 2. TypeScript Compilation

```bash
npm run typecheck
```

**Expected:** Exit code 0.

### 3. CLI Entry Point

```bash
npm run build
node dist/cli.js --help
node dist/cli.js --quickstart
```

**Expected:**
- `--help` shows all commands and options
- `--quickstart` shows condensed help (~250 tokens)

### 4. Configuration Priority

Verify precedence (highest first):
1. CLI flags
2. Environment variables (OCC_*, CLAWDBOT_*)
3. Config file (~/.config/occ/config.json, etc.)
4. Defaults

### 5. Config File Locations

Verify these paths are checked:
- `$XDG_CONFIG_HOME/occ/config.json`
- `~/.config/occ/config.json`
- `~/.occrc.json`
- `~/.occ.json`
- `./.occrc.json`
- `./occ.config.json`

### 6. Environment Variables

Verify:
- `CLAWDBOT_STATE_DIR` → state directory
- `CLAWDBOT_AGENT_ID` → default agent
- `OCC_PRESET` → default preset
- `OCC_OUTPUT_FORMAT` → output format
- `OCC_VERBOSE` → verbose flag

### 7. SDK Exports

Verify `src/index.ts` exports:
- All types
- All errors
- Core operations (executeEdit, executeClone, removeToolCalls)
- IO operations (readSessionFile, resolveSessionId, etc.)
- Configuration (loadConfiguration, resolvePreset)

### 8. Build and Package

```bash
npm run build
npm pack --dry-run
```

**Expected:**
- Build succeeds
- Package includes dist/cli.js as bin entry

## Final Verification Commands

```bash
# Full test suite
npm test

# Typecheck
npm run typecheck

# Build
npm run build

# Test CLI
node dist/cli.js --quickstart
node dist/cli.js --help
node dist/cli.js list --help
node dist/cli.js edit --help
```

## Pass Criteria

- [ ] All 63 tests pass
- [ ] No TypeScript errors
- [ ] CLI builds and runs
- [ ] Help displays correctly
- [ ] Quickstart is ~250 tokens
- [ ] Config priority correct
- [ ] SDK exports complete

## Feature Complete Checklist

After this story:
- [ ] `occ list` works
- [ ] `occ info <id>` works
- [ ] `occ edit <id> --strip-tools` works
- [ ] `occ clone <id> --strip-tools` works
- [ ] `occ restore <id>` works
- [ ] `occ --help` works
- [ ] `occ --quickstart` works
- [ ] Configuration loading works
- [ ] All 63 tests pass
- [ ] Ready for manual testing with real OpenClaw

## Fail Actions

If verification fails:
1. Document failures
2. Return to Green phase to fix
3. Re-verify

## Next Steps After Verification

1. **Gorilla Testing:** Manual testing with real OpenClaw sessions
2. **Integration Test:** Have Molt run `occ edit --strip-tools` on his own session
3. **Package and Release:** `npm publish` when ready
