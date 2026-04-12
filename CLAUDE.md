# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run unit tests (Vitest)
npm run test:e2e     # Run E2E tests (Playwright)
npx supabase start   # Start local Supabase
npx supabase db push # Apply migrations
```

## Architecture Overview

KFANDRA Helper is a **Next.js 14+ PWA** for a football club in Pune, India.

**Two modes:**
1. **MMG (Monthly Multi-Games)** — Session-based points tracking (attendance, packing, game performance)
2. **KLCFESGR1** — League/cup competition with clubs, balance sheets, player loans (currency: Kroopies)

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Supabase (Auth, PostgreSQL, Edge Functions)

**Roles:** super_admin > coach > admin > user

**Key rule:** Google Sheets remain source of truth during validation. App stores data independently in Supabase.

## Conventions & Patterns

- TypeScript strict mode
- App Router (Next.js) with server components by default, `'use client'` only when needed
- All game rules externalized in `app_config` Supabase table (not hardcoded)
- Row-Level Security (RLS) on all tables
- Every feature needs tests before implementation (TDD via superpowers)
- Commits: one bead = one commit with clear message
- Mobile-first responsive design
