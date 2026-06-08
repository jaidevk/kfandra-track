# KFANDRA Helper

A mobile-first PWA for a football club in Pune, India. Players track three
things: **MMG** (per-session points), **Gym** (daily logging), and **Diet**
(daily food logging). Built with Next.js + TypeScript + Tailwind, backed by
Supabase (PostgreSQL), and hosted on Vercel.

## Guides

- **[Player usage guide](docs/usage-guide.md)** — how to register and log
  sessions, gym, and diet. Shareable with members. A print/share-ready
  **[PDF](docs/usage-guide.pdf)** is generated from it via `npm run docs:pdf`.
- **[Admin guide](docs/admin-guide.md)** — view the database, edit scoring and
  catalogues, manage players/roles, env vars, and deploys. Internal/staff.

## Development

```bash
npm install          # install dependencies
npm run dev          # dev server at http://localhost:3000
npm run lint         # ESLint
npm run test         # unit tests (Vitest)
npm run build        # production build
npx supabase start   # local Supabase stack (needs Docker)
npx supabase db push # apply migrations to the linked database
```

All game rules (scoring, game types, food/gym catalogues) live in database
tables and are editable at runtime — see the admin guide. Deployment is
automatic: pushing to `main` runs CI and deploys to production via Vercel.

For AI-agent contribution conventions, see [CLAUDE.md](CLAUDE.md).
