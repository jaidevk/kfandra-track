-- Label overrides: admin-editable values that override src/content/strings.ts.
-- Key is a dot-path (e.g. 'home.mmg.title'); value is the replacement string.
-- The app deep-merges these over the typed defaults at render time, so a missing
-- row simply falls back to the code default.
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
