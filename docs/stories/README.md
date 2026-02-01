# oc-context-cleaner Stories

This directory contains the story breakdown and execution prompts for implementing oc-context-cleaner using SDD (Spec-Driven Development).

## Story Overview

| Story | Name | Tests | Running Total | Description |
|-------|------|-------|---------------|-------------|
| 0 | Infrastructure | 0 | 0 | Types, fixtures, error classes |
| 1 | Core Algorithm | 8 | 8 | Turn boundaries, tool removal |
| 2 | IO Layer | 0 | 8 | Session read/write, discovery |
| 3 | Edit Flow | 19 | 27 | Edit command with backup |
| 4 | Clone Flow | 11 | 38 | Clone command with index |
| 5 | Support Commands | 19 | 57 | List, info, restore |
| 6 | Configuration | 6 | 63 | Config loading, CLI entry |

**Total: 63 tests**

## Story Dependencies

```
Story 0 (Infrastructure)
    ↓
Story 1 (Core Algorithm)
    ↓
Story 2 (IO Layer)
    ↓
    ├── Story 3 (Edit Flow)
    │       ↓
    └── Story 4 (Clone Flow)
            ↓
        Story 5 (Support Commands)
            ↓
        Story 6 (Configuration)
```

## Execution Pattern

Each story follows the SDD Story Execution Cycle:

1. **Skeleton + Red** — Create stubs, write failing tests
2. **Green** — Implement until tests pass
3. **Gorilla** — Manual testing (after all stories)
4. **Verify** — Final verification against spec

## Prompts Per Story

| Story | Skeleton+Red | Green | Verify |
|-------|--------------|-------|--------|
| 0 | prompt-0.1-setup.md | — | prompt-0.R-verify.md |
| 1 | prompt-1.1-skeleton-red.md | prompt-1.2-green.md | prompt-1.R-verify.md |
| 2 | prompt-2.1-skeleton-red.md | prompt-2.2-green.md | prompt-2.R-verify.md |
| 3 | prompt-3.1-skeleton-red.md | prompt-3.2-green.md | prompt-3.R-verify.md |
| 4 | prompt-4.1-skeleton-red.md | prompt-4.2-green.md | prompt-4.R-verify.md |
| 5 | prompt-5.1-skeleton-red.md | prompt-5.2-green.md | prompt-5.R-verify.md |
| 6 | prompt-6.1-skeleton-red.md | prompt-6.2-green.md | prompt-6.R-verify.md |

## AC Coverage by Story

### Story 0: Infrastructure
- No ACs (setup only)

### Story 1: Core Algorithm
- AC-5.1 through AC-5.8 (Tool stripping)

### Story 2: IO Layer
- AC-1.6, AC-1.7, AC-1.8 (Session discovery)
- AC-3.6, AC-3.8 (Edit session resolution)
- AC-4.8 (Clone session resolution)

### Story 3: Edit Flow
- AC-3.1 through AC-3.8 (Edit operation)
- AC-6.1, AC-6.2, AC-6.5 (Backup management)
- AC-7.1, AC-7.2, AC-7.4, AC-7.5, AC-7.6 (Output)

### Story 4: Clone Flow
- AC-4.1 through AC-4.10 (Clone operation)
- AC-7.3 (JSON output)

### Story 5: Support Commands
- AC-1.1 through AC-1.5, AC-1.9 (List command)
- AC-2.1 through AC-2.7 (Info command)
- AC-6.3, AC-6.4 (Restore command)

### Story 6: Configuration
- AC-7.7, AC-7.8 (Help/quickstart)
- AC-8.1 through AC-8.4 (Configuration)

## How to Execute

### For Orchestrator

1. Execute stories in order (0 → 6)
2. For each story:
   - Give Skeleton+Red prompt to fresh Senior Engineer context
   - Verify tests fail with NotImplementedError
   - Give Green prompt to fresh Senior Engineer context
   - Verify all tests pass
   - Run Verify prompt (can use different model for pedantic review)
3. After Story 6, perform Gorilla testing with real OpenClaw

### For Senior Engineer

1. Read the prompt completely before starting
2. Execute exactly as specified
3. Do not implement beyond the story's scope
4. Verify with the commands specified
5. Report blockers immediately

## Reference Documents

- **Feature Spec:** `docs/feature-spec.md`
- **Tech Design:** `docs/tech-design.md`
- **Product Brief:** `docs/product-brief.md`

## Model Recommendations

| Phase | Recommended Model |
|-------|-------------------|
| Orchestration | Claude Opus 4.5 |
| Implementation | Claude Code senior-engineer subagent |
| Verification | GPT 5.2 / GPT 5.2 Codex |

---

*Generated as part of SDD Phase 4: Story Sharding*
