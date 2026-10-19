---
name: handover-capture
description: Use when ending a work session, pausing a feature mid-flight, or when the user asks for a handover / "capture where we are" — writes a dated file in handover/ that a future session (or another person) can start from cold, then updates the handover/README.md index and pushes. Also use at the START of a session to find and read the latest handover.
---

# Handover capture

## Overview

`handover/` holds one dated file per handover, newest first in
`handover/README.md`. A handover records what a cold reader **cannot** get from
`git log`, `bd`, or the specs: what we're in the middle of, what was decided and
by whom, what we're waiting on, and the exact next step.

**Rule of thumb:** link, don't copy. Beads, specs, plans and PRs already hold
the detail. The handover is the map, not the territory.

## When to use

- The user says "handover", "capture where we are", "wrap up", or invokes `/handover-capture`.
- Before ending a session with work in flight, blocked, or waiting on KFANDRA.
- Starting a session: read `handover/README.md`, then the newest file it lists, before `bd ready`.

Not for: per-feature design (use `docs/superpowers/specs/`), task tracking (use
`bd`), or persistent facts (use `bd remember`).

## Steps

1. **Gather state** (run these; don't guess):
   ```bash
   git status -sb && git log --oneline -10
   git branch -a --no-merged main
   gh pr list --state open --json number,title,headRefName
   bd list --status in_progress
   bd ready | head -25
   ls -t docs/superpowers/specs docs/superpowers/plans | head
   ls -t handover/*.md 2>/dev/null | head -3
   ```
   Read the previous handover so this one says what changed since.
2. **Pull from the conversation** what only it knows: decisions made (and by
   whom: Jaidev, KFANDRA/Coach), answers received, open questions, things
   tried that failed, gotchas, user preferences stated this session.
3. **Write** `handover/YYYY-MM-DD-<short-topic>.md` from the template below.
   Same day, second handover: add `-2`. Use today's date in IST.
4. **Update** `handover/README.md`: add one line at the top of the index:
   `- [YYYY-MM-DD — Title](file.md) — one-line hook`. Update the "Current
   state" block in the README to match the new file.
5. **Check** before committing:
   - Every bead id, file path, PR number and branch you cite exists (`bd show`, `ls`, `gh pr view`).
   - No secrets, tokens, phone numbers, PINs, or email addresses.
   - No personal details from KFANDRA's emails beyond the answers themselves (link the email by date, don't copy it in).
6. **Commit and push** (docs-only, straight to `main` is fine):
   ```bash
   git add handover/ && git commit -m "docs(handover): <topic>"
   git pull --rebase && bd dolt push && git push
   ```
7. **Tell the user** the file path and the one-line "Next step".

## Template

```markdown
# Handover — <topic>

**Date:** YYYY-MM-DD · **Branch:** `main` @ `<sha>` · **Previous:** [<date>](<file>.md)

## TL;DR
Two or three sentences: where things stand and the single next action.

## Done this session
- What shipped, with PR / commit / bead ids. One line each.

## In flight
- Branches, open PRs, beads in_progress, uncommitted work. "None" if none.

## Decisions
| Decision | Who | Date | Recorded in |
|---|---|---|---|

## Waiting on
- Who owes what (KFANDRA answers, Jaidev approvals, prod checks), and what it blocks.

## Next steps
1. The very next action, concrete enough to start without asking.
2. …

## Gotchas
- Non-obvious things that cost time this session (env, tooling, permissions, flaky tests).

## Pointers
- Specs, plans, beads, docs worth opening first.
```

Drop a section only if it would say "None" **and** a cold reader wouldn't
wonder about it. Keep the whole file under ~120 lines.

## Common mistakes

| Mistake | Fix |
|---|---|
| Re-pasting spec tables or question lists | Link the spec section; summarise the delta |
| "Next: continue League Scoring" | Name the skill/command/file to start with |
| Citing a bead or branch from memory | Verify it with `bd show` / `git branch -a` |
| Forgetting the README index | The index is how the next session finds the file |
| Leaving it uncommitted | A handover that isn't pushed doesn't exist for the next session |
