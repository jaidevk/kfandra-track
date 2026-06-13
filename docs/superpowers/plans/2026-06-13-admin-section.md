# Admin Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a staff-gated `/admin` section where any staff member can view player submissions (MMG + gym + diet, by date and by player) and edit on-screen labels without a code change.

**Architecture:** New routes under `src/app/admin/`, gated by a `requireStaff`/`requireEditor` guard and `middleware.ts`. Labels use an **override layer**: `strings.ts` stays the typed default; a `label_overrides` DB table holds only changed values; a server resolver deep-merges them and feeds resolved strings to (now server-wrapped) consumers. Submissions are read through a new admin repository reusing existing scoring.

**Tech Stack:** Next.js App Router (server components + server actions), TypeScript, Supabase (service-role admin client), Tailwind, Vitest (unit/integration), Playwright (E2E).

**Companion spec:** `docs/superpowers/specs/2026-06-13-admin-and-sheets-design.md`.

---

## File map

| File | Responsibility |
|---|---|
| `src/lib/auth/roles.ts` | Pure role predicates (`isStaffRole`, `isEditorRole`) — unit-testable, no I/O |
| `src/lib/auth/guard.ts` | `requireStaff()` / `requireEditor()` — resolve player, redirect/throw |
| `middleware.ts` | Coarse gate: redirect non-staff away from `/admin/*` |
| `supabase/migrations/20260613120000_label_overrides.sql` | `label_overrides` table + RLS |
| `src/content/string-paths.ts` | Typed registry of editable label paths + get/set by dot-path |
| `src/content/resolve-strings.ts` | Load overrides, deep-merge over defaults, cached |
| `src/lib/admin/labels-repository.ts` | DB reads/writes for overrides (service-role) |
| `src/lib/admin/labels-actions.ts` | `setLabelOverride` / `clearLabelOverride` server actions (editor-gated) |
| `src/lib/admin/submissions-repository.ts` | `listSessions`, `getSessionSubmissions`, `listPlayers`, `getPlayerSubmissions` |
| `src/app/admin/layout.tsx` | Staff gate + admin chrome |
| `src/app/admin/page.tsx` | Dashboard (links to sections) |
| `src/app/admin/labels/page.tsx` + `labels-editor.tsx` | Label editor UI |
| `src/app/admin/submissions/page.tsx` + view components | Submissions browser |
| `src/app/page.tsx` → `home-screen.tsx` | Split: server page reads resolved strings, client renders |
| `src/app/login/page.tsx` / `login-form.tsx` | Pass resolved strings as a prop |
| `src/content/strings.ts` | Add an `admin.*` section (UI chrome) |

---

## Task 1: Role predicates

**Files:**
- Create: `src/lib/auth/roles.ts`
- Test: `src/lib/auth/roles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/auth/roles.test.ts
import { describe, it, expect } from "vitest";
import { isStaffRole, isEditorRole } from "./roles";

describe("role predicates", () => {
  it("treats super_admin, coach, admin as staff; user is not", () => {
    expect(isStaffRole("super_admin")).toBe(true);
    expect(isStaffRole("coach")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("user")).toBe(false);
  });

  it("treats the same staff set as editors (admins included, per decision)", () => {
    expect(isEditorRole("super_admin")).toBe(true);
    expect(isEditorRole("coach")).toBe(true);
    expect(isEditorRole("admin")).toBe(true);
    expect(isEditorRole("user")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/roles.test.ts`
Expected: FAIL — `isStaffRole is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/auth/roles.ts
import type { CurrentPlayer } from "./current-user";

export type Role = CurrentPlayer["role"];

const STAFF: ReadonlySet<Role> = new Set(["super_admin", "coach", "admin"]);

/** Can view the admin section. */
export function isStaffRole(role: Role): boolean {
  return STAFF.has(role);
}

/**
 * Can perform admin edits. Currently identical to staff (admins included),
 * kept separate so the edit set can be tightened later without touching callers.
 */
export function isEditorRole(role: Role): boolean {
  return STAFF.has(role);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/roles.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/roles.ts src/lib/auth/roles.test.ts
git commit -m "Admin: role predicates (isStaffRole/isEditorRole)"
```

---

## Task 2: Server guards

**Files:**
- Create: `src/lib/auth/guard.ts`

- [ ] **Step 1: Write the implementation** (thin glue over tested predicates + `getCurrentPlayer`; covered by the E2E in Task 11)

```ts
// src/lib/auth/guard.ts
import "server-only";
import { redirect } from "next/navigation";
import { getCurrentPlayer, type CurrentPlayer } from "./current-user";
import { isStaffRole, isEditorRole } from "./roles";

/** Require a signed-in staff member; redirect otherwise. Returns the player. */
export async function requireStaff(next = "/admin"): Promise<CurrentPlayer> {
  const player = await getCurrentPlayer();
  if (!player) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!isStaffRole(player.role)) redirect("/");
  return player;
}

/** Require edit rights (for server actions that mutate). Throws if not allowed. */
export async function requireEditor(): Promise<CurrentPlayer> {
  const player = await getCurrentPlayer();
  if (!player || !isEditorRole(player.role)) {
    throw new Error("Not authorized.");
  }
  return player;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/guard.ts
git commit -m "Admin: requireStaff/requireEditor guards"
```

---

## Task 3: Admin route shell + middleware

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`
- Create: `middleware.ts` (project root)
- Modify: `src/content/strings.ts` (add `admin` section)

- [ ] **Step 1: Add admin strings** — append inside the `strings` object, after `login`:

```ts
  /** Admin section chrome (staff-only screens). */
  admin: {
    title: "Admin",
    subtitle: "KFANDRA staff only",
    submissionsCard: { title: "Submissions", subtitle: "View by date or player" },
    labelsCard: { title: "Labels", subtitle: "Edit on-screen wording" },
    backToApp: "← Back to app",
  },
```

- [ ] **Step 2: Layout with staff gate**

```tsx
// src/app/admin/layout.tsx
import { requireStaff } from "@/lib/auth/guard";
import Link from "next/link";
import { strings } from "@/content/strings";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const player = await requireStaff();
  const { admin } = strings;
  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {admin.subtitle}
          </p>
          <h1 className="text-xl font-bold text-gray-900">{admin.title}</h1>
        </div>
        <div className="text-right text-[11px] text-gray-500">
          <p className="font-semibold text-gray-700">{player.displayName}</p>
          <Link href="/" className="hover:underline">{admin.backToApp}</Link>
        </div>
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Dashboard page**

```tsx
// src/app/admin/page.tsx
import Link from "next/link";
import { strings } from "@/content/strings";

export default function AdminDashboard() {
  const { admin } = strings;
  const cards = [
    { href: "/admin/submissions", ...admin.submissionsCard },
    { href: "/admin/labels", ...admin.labelsCard },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c) => (
        <Link key={c.href} href={c.href}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-gray-300">
          <h2 className="text-base font-bold text-gray-900">{c.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{c.subtitle}</p>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Middleware (coarse gate)** — note: middleware can't read the DB; it only checks a valid session cookie exists, the layout does the role check.

```ts
// middleware.ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("session"); // cookie name set by src/lib/auth/cookie.ts
  if (!hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
```

> **Before implementing Step 4:** open `src/lib/auth/cookie.ts` and confirm the exact cookie name; replace `"session"` above if it differs.

- [ ] **Step 5: Verify in browser** — `npm run dev`, register/login a player, visit `/admin`. A `user`-role player should be redirected to `/`; promote them in the DB (`update players set role='coach' …`) and confirm `/admin` renders with both cards.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/ middleware.ts src/content/strings.ts
git commit -m "Admin: gated route shell, dashboard, middleware"
```

---

## Task 4: `label_overrides` migration

**Files:**
- Create: `supabase/migrations/20260613120000_label_overrides.sql`

- [ ] **Step 1: Write the migration** (mirrors the app_config staff-write/all-read RLS pattern)

```sql
-- Label overrides: admin-editable values that override src/content/strings.ts.
-- Key is a dot-path (e.g. 'home.mmg.title'); value is the replacement string.
create table public.label_overrides (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.players(id) on delete set null
);

comment on table public.label_overrides is
  'Overrides for src/content/strings.ts. RLS: readable by all authenticated, writable by staff.';

create trigger label_overrides_set_updated_at
  before update on public.label_overrides
  for each row execute function app.set_updated_at();

alter table public.label_overrides enable row level security;

create policy label_overrides_select_all on public.label_overrides
  for select to authenticated using (true);
create policy label_overrides_write_staff on public.label_overrides
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
```

> **Before implementing:** confirm the shared updated-at trigger function name in `20260607120001_core_identity_and_config.sql` (grep `set_updated_at`); use whatever it is (`app.set_updated_at` assumed).

- [ ] **Step 2: Apply locally**

Run: `npx supabase db push` (or `npx supabase migration up`)
Expected: applies cleanly; `label_overrides` exists in Studio.

- [ ] **Step 3: Regenerate DB types**

Run: `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts`
Expected: `label_overrides` appears in the generated `Database` type.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613120000_label_overrides.sql src/lib/supabase/database.types.ts
git commit -m "Admin: label_overrides table + RLS"
```

---

## Task 5: Editable-path registry

**Files:**
- Create: `src/content/string-paths.ts`
- Test: `src/content/string-paths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/content/string-paths.test.ts
import { describe, it, expect } from "vitest";
import { EDITABLE_PATHS, getByPath, setByPath } from "./string-paths";
import { strings } from "./strings";

describe("string paths", () => {
  it("every editable path resolves to a string in defaults", () => {
    for (const p of EDITABLE_PATHS) {
      expect(typeof getByPath(strings, p)).toBe("string");
    }
  });

  it("setByPath returns a deep clone with the path replaced, leaving the original untouched", () => {
    const next = setByPath(strings, "home.mmg.title", "Games");
    expect(getByPath(next, "home.mmg.title")).toBe("Games");
    expect(getByPath(strings, "home.mmg.title")).toBe("MMG"); // original intact
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/string-paths.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/content/string-paths.ts
import { strings } from "./strings";

/** Recursively enumerate dot-paths to every string leaf. */
function collect(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") return [prefix];
  if (obj && typeof obj === "object") {
    return Object.entries(obj).flatMap(([k, v]) =>
      collect(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [];
}

/** All editable label paths (every string leaf in strings.ts). */
export const EDITABLE_PATHS: readonly string[] = collect(strings);

export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

/** Immutably set a leaf by dot-path, returning a deep-cloned object. */
export function setByPath<T>(obj: T, path: string, value: string): T {
  const clone: unknown = structuredClone(obj);
  const keys = path.split(".");
  let cur = clone as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
  return clone as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/string-paths.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/string-paths.ts src/content/string-paths.test.ts
git commit -m "Admin: editable string-path registry + get/set helpers"
```

---

## Task 6: Resolver (deep-merge overrides over defaults)

**Files:**
- Create: `src/content/resolve-strings.ts`
- Create: `src/lib/admin/labels-repository.ts`
- Test: `src/content/resolve-strings.test.ts`

- [ ] **Step 1: Write the failing test** (pure merge function, independent of DB)

```ts
// src/content/resolve-strings.test.ts
import { describe, it, expect } from "vitest";
import { applyOverrides } from "./resolve-strings";
import { strings } from "./strings";

describe("applyOverrides", () => {
  it("overrides only the given paths, leaving others at default", () => {
    const r = applyOverrides(strings, { "home.mmg.title": "Games", "brand.appName": "KApp" });
    expect(r.home.mmg.title).toBe("Games");
    expect(r.brand.appName).toBe("KApp");
    expect(r.home.gym.title).toBe("Gym"); // untouched
  });

  it("ignores unknown/non-leaf paths defensively", () => {
    const r = applyOverrides(strings, { "home.nope": "x", "home": "y" });
    expect(r.home.mmg.title).toBe("MMG");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/content/resolve-strings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure merge + the cached DB-backed resolver**

```ts
// src/content/resolve-strings.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { strings, type AppStrings } from "./strings";
import { getByPath, setByPath } from "./string-paths";
import { loadLabelOverrides } from "@/lib/admin/labels-repository";

export const LABELS_CACHE_TAG = "label-overrides";

/** Pure: apply a {path: value} map onto a copy of the defaults. */
export function applyOverrides(base: AppStrings, overrides: Record<string, string>): AppStrings {
  let out = base;
  for (const [path, value] of Object.entries(overrides)) {
    if (typeof getByPath(out, path) === "string") out = setByPath(out, path, value);
  }
  return out;
}

const cachedOverrides = unstable_cache(
  async () => loadLabelOverrides(),
  ["label-overrides"],
  { tags: [LABELS_CACHE_TAG] },
);

/** Resolved strings for rendering: defaults with DB overrides merged in. */
export async function getStrings(): Promise<AppStrings> {
  const overrides = await cachedOverrides();
  return applyOverrides(strings, overrides);
}
```

```ts
// src/lib/admin/labels-repository.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** All overrides as a {key: value} map. */
export async function loadLabelOverrides(): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("label_overrides").select("key, value");
  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.key, r.value]));
}

export async function upsertLabelOverride(key: string, value: string, updatedBy: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("label_overrides")
    .upsert({ key, value, updated_by: updatedBy, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function deleteLabelOverride(key: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("label_overrides").delete().eq("key", key);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/content/resolve-strings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/resolve-strings.ts src/lib/admin/labels-repository.ts src/content/resolve-strings.test.ts
git commit -m "Admin: label resolver + overrides repository"
```

---

## Task 7: Label server actions (editor-gated)

**Files:**
- Create: `src/lib/admin/labels-actions.ts`
- Test: `src/lib/admin/labels-actions.test.ts`

- [ ] **Step 1: Write the failing test** (guard rejects non-editors; mock guard + repo)

```ts
// src/lib/admin/labels-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/guard", () => ({ requireEditor: vi.fn() }));
vi.mock("./labels-repository", () => ({
  upsertLabelOverride: vi.fn(), deleteLabelOverride: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { requireEditor } from "@/lib/auth/guard";
import { upsertLabelOverride } from "./labels-repository";
import { setLabelOverride } from "./labels-actions";

beforeEach(() => vi.clearAllMocks());

describe("setLabelOverride", () => {
  it("rejects unknown paths before writing", async () => {
    (requireEditor as any).mockResolvedValue({ id: "p1" });
    const res = await setLabelOverride("not.a.real.path", "x");
    expect(res.ok).toBe(false);
    expect(upsertLabelOverride).not.toHaveBeenCalled();
  });

  it("writes a valid path for an editor", async () => {
    (requireEditor as any).mockResolvedValue({ id: "p1" });
    const res = await setLabelOverride("home.mmg.title", "Games");
    expect(res.ok).toBe(true);
    expect(upsertLabelOverride).toHaveBeenCalledWith("home.mmg.title", "Games", "p1");
  });

  it("propagates an authorization failure from the guard", async () => {
    (requireEditor as any).mockRejectedValue(new Error("Not authorized."));
    const res = await setLabelOverride("home.mmg.title", "Games");
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/admin/labels-actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/admin/labels-actions.ts
"use server";
import { revalidateTag } from "next/cache";
import { requireEditor } from "@/lib/auth/guard";
import { EDITABLE_PATHS } from "@/content/string-paths";
import { LABELS_CACHE_TAG } from "@/content/resolve-strings";
import { upsertLabelOverride, deleteLabelOverride } from "./labels-repository";

type Result = { ok: true } | { ok: false; error: string };
const VALID = new Set(EDITABLE_PATHS);

export async function setLabelOverride(path: string, value: string): Promise<Result> {
  try {
    const player = await requireEditor();
    if (!VALID.has(path)) return { ok: false, error: "Unknown label." };
    await upsertLabelOverride(path, value, player.id);
    revalidateTag(LABELS_CACHE_TAG);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function clearLabelOverride(path: string): Promise<Result> {
  try {
    await requireEditor();
    await deleteLabelOverride(path);
    revalidateTag(LABELS_CACHE_TAG);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/admin/labels-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/labels-actions.ts src/lib/admin/labels-actions.test.ts
git commit -m "Admin: label override server actions (editor-gated, path-validated)"
```

---

## Task 8: Labels editor UI

**Files:**
- Create: `src/app/admin/labels/page.tsx` (server), `src/app/admin/labels/labels-editor.tsx` (client)

- [ ] **Step 1: Server page** — load defaults + current overrides, hand to the client editor.

```tsx
// src/app/admin/labels/page.tsx
import { strings } from "@/content/strings";
import { EDITABLE_PATHS, getByPath } from "@/content/string-paths";
import { loadLabelOverrides } from "@/lib/admin/labels-repository";
import LabelsEditor from "./labels-editor";

export default async function LabelsPage() {
  const overrides = await loadLabelOverrides();
  const rows = EDITABLE_PATHS.map((path) => ({
    path,
    def: String(getByPath(strings, path)),
    override: overrides[path] ?? null,
  }));
  return <LabelsEditor rows={rows} />;
}
```

- [ ] **Step 2: Client editor** — per-row: show default, editable value, Save + Reset.

```tsx
// src/app/admin/labels/labels-editor.tsx
"use client";
import { useState } from "react";
import { setLabelOverride, clearLabelOverride } from "@/lib/admin/labels-actions";

type Row = { path: string; def: string; override: string | null };

export default function LabelsEditor({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-2">
      <p className="mb-3 text-sm text-gray-500">
        Edit the words shown on screen. Blank = use the default. Changes go live immediately.
      </p>
      {rows.map((r) => <LabelRow key={r.path} row={r} />)}
    </div>
  );
}

function LabelRow({ row }: { row: Row }) {
  const [value, setValue] = useState(row.override ?? row.def);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const isOverridden = row.override !== null;

  const save = async () => {
    setBusy(true); setMsg(null);
    const res = value === row.def
      ? await clearLabelOverride(row.path)
      : await setLabelOverride(row.path, value);
    setMsg(res.ok ? "Saved" : res.error); setBusy(false);
  };
  const reset = async () => {
    setBusy(true); setMsg(null);
    const res = await clearLabelOverride(row.path);
    if (res.ok) setValue(row.def);
    setMsg(res.ok ? "Reset" : res.error); setBusy(false);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <code className="text-[11px] text-gray-400">{row.path}</code>
        {isOverridden && <span className="text-[10px] font-bold uppercase text-amber-600">edited</span>}
      </div>
      <p className="mt-0.5 text-[11px] text-gray-400">default: “{row.def}”</p>
      <div className="mt-1.5 flex gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} disabled={busy}
          className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none" />
        <button onClick={save} disabled={busy || value === (row.override ?? row.def)}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Save</button>
        <button onClick={reset} disabled={busy || !isOverridden}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 disabled:opacity-30">Reset</button>
      </div>
      {msg && <p className="mt-1 text-[11px] text-gray-500">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser** — as a staff user, open `/admin/labels`, change `home.mmg.title` to "Games", Save, then load `/` and confirm the home card shows "Games". Reset and confirm it reverts.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/labels/
git commit -m "Admin: labels editor UI"
```

> Step 3 only fully passes once Task 9 wires consumers to resolved strings. If `/` still shows "MMG", proceed to Task 9 then re-verify.

---

## Task 9: Wire consumers to resolved strings

**Files:**
- Create: `src/app/home-screen.tsx` (client; the current `page.tsx` body)
- Modify: `src/app/page.tsx` (becomes a server component)
- Modify: `src/app/login/page.tsx`, `src/app/login/login-form.tsx`

- [ ] **Step 1: Move the current `src/app/page.tsx` client body into `src/app/home-screen.tsx`**, renaming the component to `HomeScreen`, adding `"use client"`, and changing it to take `strings` as a prop instead of importing it:

```tsx
// src/app/home-screen.tsx  (top of file)
"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import type { AppStrings } from "@/content/strings";
import { AnalyticsEvent, capture } from "@/lib/observability/analytics";

export default function HomeScreen({ strings }: { strings: AppStrings }) {
  const { brand, home } = strings;
  // …rest of the existing JSX unchanged…
}
```

- [ ] **Step 2: Replace `src/app/page.tsx` with a server component**

```tsx
// src/app/page.tsx
import { getStrings } from "@/content/resolve-strings";
import HomeScreen from "./home-screen";

export default async function Home() {
  const strings = await getStrings();
  return <HomeScreen strings={strings} />;
}
```

- [ ] **Step 3: Pass resolved strings into the login form.** In `src/app/login/page.tsx` call `getStrings()` and pass `strings` to `<LoginForm>`; in `login-form.tsx` replace the module-level `const { brand, login: t } = strings;` import with a `strings` prop:

```tsx
// src/app/login/page.tsx — add:
import { getStrings } from "@/content/resolve-strings";
// …
const strings = await getStrings();
return <LoginForm next={safeNext} strings={strings} />;
```

```tsx
// src/app/login/login-form.tsx — change the signature + derivation:
import type { AppStrings } from "@/content/strings";
export default function LoginForm({ next, strings }: { next: string; strings: AppStrings }) {
  const { brand, login: t } = strings;
  // …rest unchanged…
}
```

- [ ] **Step 4: Type-check + verify**

Run: `npx tsc --noEmit` (expect 0), then re-run the Task 8 Step 3 browser check — overriding `home.mmg.title` now changes `/`.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/home-screen.tsx src/app/login/
git commit -m "Admin: render resolved strings on home + login (override layer live)"
```

---

## Task 10: Submissions repository

**Files:**
- Create: `src/lib/admin/submissions-repository.ts`
- Test: `src/lib/admin/submissions-repository.test.ts`

> Reuse existing readers where possible. Before writing, read `src/lib/mmg/repository.ts`, `src/lib/gym/repository.ts`, `src/lib/diet/repository.ts`, and `src/lib/mmg/order.ts` (`computeSessionOrderPoints`) to reuse their query + scoring functions rather than duplicating SQL.

- [ ] **Step 1: Write the failing test for the pure shaping helper** (the DB functions are integration-verified in the browser; the row-shaping is unit-tested)

```ts
// src/lib/admin/submissions-repository.test.ts
import { describe, it, expect } from "vitest";
import { toSessionRows } from "./submissions-repository";

describe("toSessionRows", () => {
  it("joins players to their order points, defaulting missing to zero", () => {
    const players = [{ id: "a", displayName: "Abe" }, { id: "b", displayName: "Baz" }];
    const order = [{ playerId: "a", arrivalPoints: 300, confirmationPoints: 200 }];
    const rows = toSessionRows(players, order);
    expect(rows).toEqual([
      { playerId: "a", displayName: "Abe", arrivalPoints: 300, confirmationPoints: 200 },
      { playerId: "b", displayName: "Baz", arrivalPoints: 0, confirmationPoints: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/admin/submissions-repository.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** the repository. Pure helper plus DB readers (signatures below; fill the queries using the patterns from the existing repositories read above):

```ts
// src/lib/admin/submissions-repository.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlayerRef = { id: string; displayName: string };
export type SessionRow = {
  playerId: string; displayName: string;
  arrivalPoints: number; confirmationPoints: number;
};

/** Pure: left-join players to computed order points. */
export function toSessionRows(
  players: PlayerRef[],
  order: { playerId: string; arrivalPoints: number; confirmationPoints: number }[],
): SessionRow[] {
  const byId = new Map(order.map((o) => [o.playerId, o]));
  return players.map((p) => ({
    playerId: p.id,
    displayName: p.displayName,
    arrivalPoints: byId.get(p.id)?.arrivalPoints ?? 0,
    confirmationPoints: byId.get(p.id)?.confirmationPoints ?? 0,
  }));
}

export async function listPlayers(): Promise<PlayerRef[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("players")
    .select("id, display_name").eq("is_active", true).order("display_name");
  return (data ?? []).map((p) => ({ id: p.id, displayName: p.display_name }));
}

export async function listSessions(): Promise<{ id: string; date: string; label: string | null }[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("sessions")
    .select("id, session_date, label").order("session_date", { ascending: false });
  return (data ?? []).map((s) => ({ id: s.id, date: s.session_date, label: s.label }));
}

// getSessionSubmissions(sessionId): combine listPlayers + computeSessionOrderPoints(sessionId)
//   + per-player game/other points via the mmg scoring readers, then toSessionRows.
// getPlayerSubmissions(playerId): that player's mmg_entries (+ gym_logs, diet_logs) across sessions.
// Implement these using the exact query shapes from the existing repositories.
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/admin/submissions-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/submissions-repository.ts src/lib/admin/submissions-repository.test.ts
git commit -m "Admin: submissions repository (sessions, players, per-session rows)"
```

---

## Task 11: Submissions browser UI + E2E

**Files:**
- Create: `src/app/admin/submissions/page.tsx` and view components
- Create: `e2e/admin.spec.ts`

- [ ] **Step 1: Build the browser** — `page.tsx` reads `?date=` / `?player=`; default lists sessions (newest first) and players. By-date shows the `getSessionSubmissions` table (player · arrival pts · confirmation pts · game pts · total). By-player shows that player's MMG/gym/diet across sessions. Server components; read via the Task 10 repository.

- [ ] **Step 2: Verify in browser** — as staff, open `/admin/submissions`, pick a date with submissions and confirm points render; pick a player and confirm their history renders.

- [ ] **Step 3: E2E** — extend the smoke harness:

```ts
// e2e/admin.spec.ts
import { test, expect, expectNoErrors } from "./fixtures";

test.describe("Admin gating", () => {
  test("a non-staff user is redirected away from /admin", async ({ page, errors }) => {
    // Register a fresh user (defaults to role 'user'), then hit /admin.
    // … register via the login form (see usage-guide flow) …
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/(login|)$/); // bounced to / or /login
    expectNoErrors(errors);
  });
});
```

- [ ] **Step 4: Run E2E**

Run: `npm run test:e2e -- e2e/admin.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/submissions/ e2e/admin.spec.ts
git commit -m "Admin: submissions browser (by date + by player) + gating E2E"
```

---

## Task 12: Full gate + ship

- [ ] **Step 1: Run the whole suite**

Run: `npm run lint && npx tsc --noEmit && npm run test && npm run build`
Expected: all pass.

- [ ] **Step 2: Push** (auto-deploys)

```bash
git pull --rebase && git push
```

- [ ] **Step 3: Close the bead**

```bash
bd close Helper-1j2 --reason "Admin section shipped: staff-gated /admin with submissions browser + label override editor. Admin guide PDF tracked separately."
```

> The **admin guide PDF** (documenting these screens) and the deferred capabilities (players/config/audit) are follow-ups — file/keep beads for them.

---

## Self-review notes
- **Spec coverage:** routes (T3,8,11), guards/access (T1,2,3), labels override layer (T4–9), submissions browser (T10,11), strings `admin.*` (T3), testing (T1,5,6,7,10,11). Admin guide PDF + deferred capabilities explicitly deferred (T12 note) — consistent with spec §1.1/§1.6.
- **Cross-task type consistency:** `EDITABLE_PATHS`, `getByPath/setByPath` (T5) used by T6/T7/T8; `LABELS_CACHE_TAG` defined T6, used T7; `getStrings` (T6) used T9; `toSessionRows`/`SessionRow` (T10) used T11.
- **Assumptions to confirm at execution:** cookie name (T3), shared `set_updated_at` trigger fn name (T4), exact reusable readers in existing repositories (T10).
