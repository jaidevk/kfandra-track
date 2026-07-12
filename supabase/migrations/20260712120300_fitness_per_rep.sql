-- ============================================================================
-- 20260712120300 — Gym reps score into MMG: points-per-rep rule
-- ----------------------------------------------------------------------------
-- KFANDRA: award points for every rep completed in a gym EXERCISE (not S&C
-- tests). Admin-editable via /admin/config like every other point rule. Reps
-- are allocated to the closest previous MMG session and added to that session's
-- total. Default 100 per rep.
-- ============================================================================

insert into public.point_rules (scope, rule_key, label, points)
select 'fitness', 'per_rep', 'Points per gym rep', 100
where not exists (
  select 1 from public.point_rules where scope = 'fitness' and rule_key = 'per_rep'
);
