import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseStatRates, type StatRates } from "./stat-rates";
import { parseSportStats, type SportStats } from "./sport-stats";
import { parseStandingsRules, type StandingsRules } from "./standings-rules";

export type { StatRates } from "./stat-rates";
export type { SportStats, Sport } from "./sport-stats";
export type { StandingsRules } from "./standings-rules";
export { DEFAULT_STAT_RATES } from "./stat-rates";
export { DEFAULT_SPORT_STATS, statsForSport } from "./sport-stats";
export { DEFAULT_STANDINGS_RULES } from "./standings-rules";

async function loadConfigValue(key: string): Promise<unknown> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

/** Load per-stat KR/MMG rates from app_config (key 'klcsra_stat_rates'). */
export async function loadStatRates(): Promise<StatRates> {
  return parseStatRates(await loadConfigValue("klcsra_stat_rates"));
}

/** Load the per-sport stat allow-list from app_config (key 'klcsra_sport_stats'). */
export async function loadSportStats(): Promise<SportStats> {
  return parseSportStats(await loadConfigValue("klcsra_sport_stats"));
}

/** Load standings rules from app_config (key 'klcsra_standings_rules'). */
export async function loadStandingsRules(): Promise<StandingsRules> {
  return parseStandingsRules(await loadConfigValue("klcsra_standings_rules"));
}
