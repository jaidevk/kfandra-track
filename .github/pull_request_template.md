## What and why

<!-- One or two sentences. Link the issue: "Closes #123" -->

## How it was tested

- [ ] `npm run lint`, `npm run test` and `npm run build` pass locally
- [ ] New/changed behaviour has tests (Vitest and/or Playwright)
- [ ] Checked on the Vercel preview link

## Checklist

- [ ] UI change: screenshot at phone width (~375 px) below
- [ ] Database change: new migration in `supabase/migrations/`, RLS on any new table, tested with `npx supabase db reset`
- [ ] No hard-coded game rules (they live in DB config tables)
- [ ] No secrets, phone numbers or player data in code, commits or this description

## Screenshots
