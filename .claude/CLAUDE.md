## Session Start Checklist

At the start of every session, read these files before doing anything else:
1. `SESSION_NOTES.md` — completed work, key decisions, pending items from prior sessions
2. `PROJECT_TASKS.md` (bottom section: "Backlog — Unimplemented Features") — the authoritative list of what is NOT yet built, with priority ratings 🔴/🟡/🟢

When the user asks "what should we work on next" or "what's left to do", always pull from the backlog section of PROJECT_TASKS.md rather than guessing.

## Context Navigation

This project has a graphify knowledge graph at graphify-out/.
When you need to understand the codebase, docs or any files in this project:
- Always query the knowledge graph first: `/graphify query "your question"`
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- Use `graphify-out/wiki/index.md` as your navigation entrypoint for browsing structure
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
