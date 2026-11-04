# Contributing

Jacaranda is the KFANDRA club app: MMG session points, Gym and Diet logging,
and the KLC league. See the [README](README.md) for an overview and the
[developer guide](docs/developer-guide.md) for the database and config map.

Just want to test the app? See [TESTING.md](TESTING.md) instead — no setup
needed.

## Ground rules

- **`main` is production.** Every merge to `main` deploys to the live app via
  Vercel. So all changes go through a **pull request** that the maintainer
  (@jaidevk) reviews and merges. Nobody pushes to `main` directly.
- **CI must pass** on the PR: lint, unit tests, production build.
- **One change per PR.** Small and focused is much easier to review.
- **Tests first.** New behaviour and bug fixes come with tests (Vitest for
  logic, Playwright for flows).
- **Mobile first.** Players use phones. Check your change at phone width
  (~375 px) and include a screenshot for any UI change.
- **Never touch production data or secrets.** You don't need them — you run
  everything locally (below).

## Setup

You need **Node 24**, **npm**, and **Docker** (for local Supabase).

```bash
git clone https://github.com/jaidevk/kfandra-track.git
cd kfandra-track
npm install

npx supabase start          # local Postgres + Studio; applies all migrations
cp .env.example .env.local  # then fill in the local values supabase start printed
npm run dev                 # http://localhost:3000
```

For `.env.local`, use the **local** URL, anon key and service-role key that
`npx supabase start` prints, and generate a `SESSION_SECRET` with the command in
`.env.example`. Leave the PostHog and Google Sheets variables empty — analytics
and the Sheets export switch themselves off.

Local Supabase starts with the catalogues (game types, scoring rules, gym and
diet foods) but no players. Register an account in the app to get started. To
make yourself an admin, change your `role` in Supabase Studio
(<http://127.0.0.1:54323>, table `players`).

## Making a change

1. **Pick or open an issue** so we agree on the change before you build it.
   Comment on it to say you're taking it.
2. **Branch** from an up-to-date `main`:
   `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>` or
   `perf/<short-name>`.
3. **Write the test, then the code.** Run the checks before pushing:
   ```bash
   npm run lint
   npm run test
   npm run build
   npm run test:e2e   # if you changed a user flow
   ```
4. **Push your branch and open a PR** against `main`. Fill in the template and
   link the issue (`Closes #123`).
5. Vercel posts a **preview link** on the PR. Check your change there too.
6. Address review comments. The maintainer merges once it's approved and CI is
   green.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
`feat(diet): …`, `fix(mmg): …`, `perf(mmg): …`, `docs: …`.

## Things that need extra care

- **Game rules live in the database**, not in code. Points, game types and the
  food/gym catalogues are in tables (`app_config`, `point_rules`, …) and edited
  at runtime. Don't hard-code numbers.
- **Database changes** go in a new file under `supabase/migrations/` (create
  one with `npx supabase migration new <name>`). Test it locally with
  `npx supabase db reset`. **Never run `npx supabase db push` or link to the
  hosted project** — the maintainer applies migrations to production after
  merging. Every table needs Row-Level Security.
- **On-screen words** are in `src/content/strings.ts`.
- **Secrets** never go in code, commits, issues or PR descriptions. The repo is
  public.

## Using an AI coding agent

You're welcome to. Agents read [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md)
for project conventions. The same rules apply: branch + PR, tests, no
production access. Review what it writes before you push — you're the author.

Task tracking for the maintainer's agents uses [beads](.beads/README.md)
(`bd`). You don't need it: GitHub issues are fine for contributors.

## Questions

Open an issue or ask in the group.
