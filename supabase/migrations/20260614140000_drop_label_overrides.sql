-- Drop the label_overrides table: in-app editing of UI strings was dropped in
-- favour of editing only point values and game-type names. The table was never
-- deployed to production, so this is a no-op there.
drop table if exists public.label_overrides;
