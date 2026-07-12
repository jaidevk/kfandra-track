---
name: querying-production-data
description: Use when a design, product, or schema decision needs real KFANDRA usage data — how often a field/bucket/flag is actually used, real value distributions, production row counts — and local Supabase only has dev seed data. Read-only queries against the linked production Supabase (project "Jacaranda", ref gcsgctfbgpihxmqqlxch).
---

# Querying production data

## Overview

Local Supabase (`.env.local` → `127.0.0.1:54321`) is **dev seed data only** — a
couple of rows. Design decisions made against it are wrong (e.g. the "Other"
MMG bucket looks unused locally but is in 55% of production entries). This skill
runs **read-only** SQL against the real production DB so decisions rest on real
usage.

## When to use

- "How often is X actually used / filled in?" before adding or restructuring a UI column, field, or bucket.
- Real value distributions, ranges, and magnitudes before choosing a layout or default.
- Any "check production data" request.

Do **not** use for writes, migrations, or anything mutating — the tool refuses
non-SELECT statements by design.

## Tool

```bash
.claude/skills/querying-production-data/query-prod.py "select count(*) from mmg_entries"
echo "select stat_key, count(*) from submission_game_stats group by 1" \
  | .claude/skills/querying-production-data/query-prod.py -
```

Returns the Management API's JSON rows. One statement per call. Run with no args
for full help.

## How it works (and the gotchas that cost time)

| Piece | Detail |
|---|---|
| Project ref | Read from `supabase/.temp/project-ref` (set by `supabase link`). |
| Auth token | macOS keychain, service `Supabase CLI` (from `supabase login`) — never printed. |
| Endpoint | Supabase Management API `POST /v1/projects/{ref}/database/query`. |
| Cloudflare | The API 403s with body `error code: 1010` unless a **browser User-Agent** is sent. The tool sets one. |

## Dead ends (don't retry these)

- **`vercel env pull` for DB creds** — `SUPABASE_SERVICE_ROLE_KEY` is marked
  *Sensitive* on Vercel and pulls back **empty**, so the Supabase REST API 401s.
  Use the Management API path above instead. (`GOOGLE_SHEETS_SA_KEY` is also
  Sensitive/empty on prod pull — the non-empty copy is in `.env.local`.)
- **Direct `psql` to prod** — no DB password is stored locally; the Management
  API + CLI token is the working path.

## Reading production Google Sheets (separate, limited)

Sheets are the source of truth during validation, but reading a specific coach
sheet needs that sheet **shared with an identity we can reach**:
- The app service account `kfandra-sheets-export@kfandra-track.iam.gserviceaccount.com`
  (auth via `GOOGLE_SHEETS_SA_KEY` in `.env.local`, using the app's own
  `googleapis`) — only works if the sheet is shared with it.
- The session's Drive connector is bound to whatever Google account was
  connected; you cannot pick the identity from here. A sheet not shared with
  that account returns "not found".

## Common mistakes

- Trusting local seed data for a "how often is this used" question — always
  check production.
- Sending multiple statements — the tool allows exactly one read-only statement.
