# AI Handoff Playbook (Codex ↔ Claude)

Purpose: Allow Codex and Claude to hand over work without re-discovery or accidental regressions.

## Rules
- Update this file at the end of every substantial session.
- Keep entries chronological (latest first).
- Record facts only; no vague notes.
- If work is partial, include the exact next step.

## Session Entry Template

```md
## Handoff Entry — YYYY-MM-DD HH:mm (Local)

Agent: Codex | Claude
Branch: `feature/...`
Sprint/Task IDs: MUI-00X, AGT-00X

### Completed
- ...
- ...

### Files Changed
- /absolute/or/repo/path/file1
- /absolute/or/repo/path/file2

### Verification Run
- Command: `...`
- Result: PASS | FAIL
- Notes: ...

### Open Work
- ...
- ...

### Blockers / Risks
- ...

### Next Exact Action
1. ...
2. ...
```

## Decision Log Template

Use when an implementation decision affects future work.

```md
### Decision — YYYY-MM-DD
- Context:
- Decision:
- Alternatives considered:
- Impact:
```

## Minimum Verification Matrix

- Frontend UI changes:
  - `cd apps/web && npx tsc --noEmit`
  - `cd apps/web && npm run build`
- Backend changes:
  - relevant `dotnet build` and targeted tests
- Cross-cutting:
  - note any unrun tests explicitly in the handoff entry

## Ownership Convention

- Agent currently active marks in-progress items in `PROJECT_TASKS.md` as `IN_PROGRESS`.
- On completion, set to `DONE` and reference the handoff entry timestamp.
- Do not overwrite prior notes; append new entries.
