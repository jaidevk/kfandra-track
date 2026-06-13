# Admin Section + Google Sheets Export — Design

- **Date:** 2026-06-13
- **Beads:** [Helper-1j2](in-app Admin section) · [Helper-0h0](Sheets export). Closes [Helper-k9u](Sheets ingest — no longer needed).
- **Status:** Approved design, pending implementation plan.

Two independent subsystems brainstormed together because the Admin section hosts
the Sheets export's config + manual re-sync control. Each can be built and shipped
on its own.

---

## 0. Current state (facts that shaped this design)

- **No admin UI exists.** Pages gate via `getCurrentPlayer()` + `redirect()`
  (e.g. `src/app/diet/page.tsx`). Roles: `super_admin > coach > admin > user`;
  DB has `is_staff()` = role in (super_admin, coach, admin). Privileged writes
  already use the service-role admin client (RLS-bypass).
- **Labels** live in `src/content/strings.ts` (typed `as const`, ~brand/home/login
  only). Consumed by importing the static object.
- **MMG data:** `mmg_entries` (+ `submission_games`, `submission_game_stats`,
  `submission_others`), one row per (player, session). Config in dedicated tables
  `point_rules`, `game_types`; `app_config` (key/jsonb) exists but is unused by code.
- **Order points** (`src/lib/scoring/order-points.ts`) are **recomputed live** on
  each finalize and **never stored**. There is no "session closed" concept.
- **No Google/Sheets code** exists. Mutations are **server actions** only.
- **PDF pipeline:** `npm run docs:pdf` → `scripts/build-usage-pdf.mjs`
  (player guide). `docs/admin-guide.md` exists but documents the *Supabase*
  workflow — to be replaced by a guide for the new Admin App.

---

## 1. Feature: Admin Section (Helper-1j2)

### 1.1 Scope
**v1 core:** view submissions · edit app labels.
**Designed-for but deferred** (architecture must accommodate, implement later):
edit/correct submissions & points · manage players (roles/active/PIN) · audit log.

### 1.2 Routes (`src/app/admin/`)
| Route | Purpose | v1 |
|---|---|---|
| `/admin` | Dashboard; links to sections | ✅ |
| `/admin/submissions` | Browse by **date** (`?date=`) and by **player** (`?player=`); MMG + gym + diet, read-only | ✅ |
| `/admin/labels` | Label override editor | ✅ |
| `/admin/players` | Roles / active / PIN reset | deferred |
| `/admin/config` | Edit `point_rules` / `game_types` | deferred |
| `/admin/audit` | Recent changes (`audit_log`) | deferred |

Server components by default; child client forms for mutations; follow the
existing per-page auth-gate pattern.

### 1.3 Access control — `src/lib/auth/guard.ts`
- `requireStaff()` — gates **viewing**: role in (super_admin, coach, admin).
- `requireEditor()` — gates **edits**: currently the same staff set (admins
  included, per decision), kept as a separate alias so the edit set can be
  tightened later without touching call sites.
- `middleware.ts` matching `/admin/*` as defense-in-depth (redirect non-staff to `/`).
- Server actions also call the guard server-side (never trust the route alone).

### 1.4 Labels override layer
- **`strings.ts` stays the typed default source** (compile-time safety, instant
  rollback). Nothing is removed from it.
- **New table `label_overrides`**: `key text PK` (dot-path, e.g. `home.mmg.title`),
  `value text`, `updated_at timestamptz`, `updated_by uuid → players`. RLS:
  staff-write, all-authenticated-read. Migration under `supabase/migrations/`.
- **Resolver `src/content/resolve-strings.ts`** (server): loads overrides, deep-merges
  over the static defaults, returns the resolved tree. Cached via `unstable_cache`,
  revalidated on save. Consumers (`page.tsx`, `login-form.tsx`) switch from importing
  the static object to receiving **resolved** strings (server reads → passes to client
  as props).
- **Editable-path registry**: a typed list derived from `strings.ts` drives the
  editor; each row shows default (read-only) + override input + **Reset**.
- **Server action `setLabelOverride(path, value)`** / `clearLabelOverride(path)` —
  `requireEditor`-gated; upsert/delete a row; revalidate the cache tag.

### 1.5 Submissions browser
- New `src/lib/admin/repository.ts`: `listSessions()`, `getSessionSubmissions(sessionId)`
  (all players + computed totals), `listPlayers()`, `getPlayerSubmissions(playerId)`.
- Reuses `computeSessionOrderPoints` / scoring for computed totals.
- Read-only tables/cards; two entry axes (date, player).

### 1.6 Strings & guide
- Add an `admin.*` section to `strings.ts` for admin UI chrome.
- **Admin guide PDF** (final deliverable): rewrite `docs/admin-guide.md` to document
  the **Admin App screens** for a non-technical reader; extend the `docs:pdf` script
  (or add `docs:pdf:admin`) to emit `docs/admin-guide.pdf`.

### 1.7 Testing (TDD)
- Unit: resolver deep-merge, path get/set, guard role checks.
- Integration: `setLabelOverride` rejects `user` role; submissions queries.
- E2E (Playwright): staff reaches `/admin`; `user` redirected; edit a label → reflected.

---

## 2. Feature: Google Sheets Export (Helper-0h0)

### 2.1 Scope & principle
One-way **export** of MMG points to a **separate, app-owned spreadsheet** (parallel
to KFANDRA's living members sheet during validation — app data stays independent).
**Phase 2 (later):** gym + diet → per-player private sheets. **Ingest is dropped**
(app self-submit is the source of truth → close Helper-k9u).

### 2.2 Target layout — app generates the whole tab
- One **spreadsheet** (app-owned), one **tab per month** (e.g. `Jun 2026`),
  auto-created if missing.
- App writes the **entire tab**: header row = that month's Tue/Thu/Sat session dates;
  side column = active-player roster (app order); cells = each player's **total** MMG
  points for that session (full computed total: order + participation + results +
  stats + others).
- Robust by construction — the app put every row/column there, so player×session →
  cell is never guessed (no fragile nickname-matching).

### 2.3 Order points stay always-live (no lock)
- Engine (`order-points.ts`) and session model are **unchanged**. Order points are
  recomputed live from whoever has submitted; confirmation points already exclude
  confirmed-but-absent players (0 pts, shrink `Nc`).
- Consequence: a session's sheet column **keeps updating** as more players submit —
  an intentional live mirror. No "closed/final" state, no snapshot.

### 2.4 Trigger & flow
- On **`finalizeMmgSessionAction`** success → re-export the **whole session column**
  (all players' current totals for that date), because one player's submit shifts
  others' order points.
- **Best-effort & non-blocking:** wrapped in try/catch; a Sheets failure logs
  `[jacaranda:error]` and **never** fails the player's finalize.
- **Manual "Re-sync month"** button in `/admin` rebuilds the active tab end-to-end
  (backstop for edits-after-finalize and transient failures).
- Autosaves do **not** export (only the explicit finalize) — keeps API calls bounded.

### 2.5 Module `src/lib/sheets/`
- `auth.ts` — build a JWT/auth client from the service-account credentials.
- `client.ts` — thin wrapper (ensure-tab, read range, batch-update cells) behind an
  **interface**, so tests inject a mock and CI makes no live calls.
- `mmg-export.ts` — compute column values (reuse scoring), resolve tab + roster +
  date columns, write.
- `config.ts` — read spreadsheet id / enabled flag from `app_config`.

### 2.6 Config (`app_config`)
| key | value | meaning |
|---|---|---|
| `sheets_export_spreadsheet_id` | string | the app-owned export spreadsheet id |
| `sheets_export_enabled` | boolean | master on/off (default false until configured) |

Admin-editable once `/admin/config` ships; until then editable via Supabase.

### 2.7 Dependency & secrets
- Add **`googleapis`**.
- Server-only env var **`GOOGLE_SHEETS_SA_KEY`** = base64 of the service-account JSON
  (base64 avoids newline issues in the private key). Decoded at runtime, never
  exposed to the client. Documented in `.env.example` and the admin guide's env table.

### 2.8 Testing (TDD)
- Unit (pure): month tab name, session-date column generation, roster ordering,
  per-player total computation.
- Integration: `mmg-export` against a **mocked** sheets client (asserts the right
  cells/values); failure path leaves finalize succeeding.

---

## 3. Manual setup steps — Sheets dependencies (one-time)

Do this once before/at first deploy of the Sheets feature. Only the person setting
it up needs Google Cloud access; **KFANDRA does not**.

### A. Create the service account (Google Cloud Console)
1. Go to <https://console.cloud.google.com> and **create or select a project**
   (e.g. `kfandra-helper`). No billing required.
2. **APIs & Services → Library →** search **"Google Sheets API" → Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account.**
   Name it e.g. `kfandra-sheets-export`. No project roles needed (it only needs
   per-sheet sharing). Create.
4. Open the service account → **Keys → Add key → Create new key → JSON**. A JSON
   file downloads. **This is a secret — keep it safe, never commit it.**
5. Note the service-account **email** (looks like
   `kfandra-sheets-export@<project>.iam.gserviceaccount.com`).

### B. Create & share the export spreadsheet
6. Create a **new Google Sheet** (this is the app-owned export sheet; *not* the
   members' sheet). Copy its **spreadsheet ID** from the URL
   (`docs.google.com/spreadsheets/d/<THIS_ID>/edit`).
7. **Share** that sheet with the service-account **email** from step 5 as **Editor**.

### C. Wire the credentials & config
8. Base64-encode the JSON key and set it as the env var:
   ```bash
   base64 -i path/to/key.json | tr -d '\n'   # macOS; copy the output
   ```
   - **Local:** add to `.env.local`:
     `GOOGLE_SHEETS_SA_KEY=<base64-string>`
   - **Production:** Vercel → project `kfandra-track` → Settings → Environment
     Variables (Production) → add `GOOGLE_SHEETS_SA_KEY` → **redeploy**.
9. Set the spreadsheet id + enable flag in `app_config` (Supabase Table Editor or SQL):
   ```sql
   insert into app_config (key, value) values
     ('sheets_export_spreadsheet_id', '"<THIS_ID>"'::jsonb),
     ('sheets_export_enabled', 'true'::jsonb)
   on conflict (key) do update set value = excluded.value;
   ```

### D. Install the library (developer)
10. `npm install googleapis` (committed to `package.json`).

After this, a player finalizing an MMG session writes that session's column into the
month tab; if anything is misconfigured the finalize still succeeds and the failure
is logged.

---

## 4. Sequencing

1. **Admin core** — guard + routes + labels override + submissions browser.
2. **Sheets export** — module + finalize hook + admin re-sync button + spreadsheet-id
   setting.
3. **Admin guide** — rewrite for the Admin App screens → `admin-guide.pdf`.
4. **Phase 2 (later):** gym/diet per-player export; deferred admin capabilities
   (players, config, audit).

## 5. Out of scope (now)
- Gym/diet sheet export; sheet **ingest**; editing the coach's living members sheet;
  session close/lock & order-point snapshots; SMS/PIN-reset flows.
