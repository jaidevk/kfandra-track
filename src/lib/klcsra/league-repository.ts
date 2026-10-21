import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MATCH_DRAFT_COLS, toMatchDraft, type MatchDraftRow } from "./repository";
import type { MatchDraft, Season } from "./types";

/**
 * Read model for the public KLC League page. Server-only, service role.
 *
 * THE public-read guarantee (closes Helper-h9i): every query here filters
 * `status = 'submitted'`, so drafts never reach /klc/league. The unit test
 * asserts the filter on each query. Nothing else may read for the league page.
 */

/**
 * The league read model's ONLY source: submitted matches for one season.
 * League matches are tagged with the season; friendlies carry no season, so
 * they are taken by date inside the season's window (they feed the MMG board
 * only). Every query filters `status = 'submitted'`: this is what keeps drafts
 * off the public league page. Newest first (see `newestFirst`).
 */
export async function listSubmittedMatchDrafts(season: Season): Promise<MatchDraft[]> {
  const admin = createAdminClient();
  const league = admin
    .from("klc_matches")
    .select(MATCH_DRAFT_COLS)
    .eq("status", "submitted")
    .eq("season_id", season.id);
  let friendlies = admin
    .from("klc_matches")
    .select(MATCH_DRAFT_COLS)
    .eq("status", "submitted")
    .eq("is_friendly", true)
    .gte("entry_date", season.startDate);
  if (season.endDate) friendlies = friendlies.lte("entry_date", season.endDate);

  const [l, f] = await Promise.all([league, friendlies]);
  if (l.error) throw new Error(`Failed to load league matches: ${l.error.message}`);
  if (f.error) throw new Error(`Failed to load friendlies: ${f.error.message}`);
  return [...(l.data ?? []), ...(f.data ?? [])]
    .map((row) => toMatchDraft(row as MatchDraftRow))
    .sort(newestFirst);
}

/**
 * Newest first, deterministically: entry date desc, then submitted_at desc
 * (nulls last), then id.
 */
function newestFirst(a: MatchDraft, b: MatchDraft): number {
  const byDate = b.entryDate.localeCompare(a.entryDate);
  if (byDate !== 0) return byDate;
  if (a.submittedAt !== b.submittedAt) {
    if (a.submittedAt === null) return 1;
    if (b.submittedAt === null) return -1;
    return b.submittedAt.localeCompare(a.submittedAt);
  }
  return a.id.localeCompare(b.id);
}
