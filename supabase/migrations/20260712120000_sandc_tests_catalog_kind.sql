-- ============================================================================
-- 20260712120000 — Add 'test' to the gym_catalog kind enum
-- ----------------------------------------------------------------------------
-- Separate migration on purpose: Postgres forbids using a newly-added enum
-- value in the same transaction that adds it, so the seed that references
-- kind='test' lives in the next migration (20260712120100).
-- ============================================================================

alter type app.gym_catalog_kind add value if not exists 'test';
