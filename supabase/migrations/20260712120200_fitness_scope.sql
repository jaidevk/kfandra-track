-- ============================================================================
-- 20260712120200 — Add 'fitness' to the point_scope enum
-- ----------------------------------------------------------------------------
-- Separate migration so the seed that references scope='fitness' (next file)
-- runs in its own transaction — Postgres forbids using a newly-added enum
-- value in the same transaction that adds it.
-- ============================================================================

alter type app.point_scope add value if not exists 'fitness';
