# KLCSRA — KLC Stats Recording App — Design (v0.3)

**Beads:** Helper-bsr · **Status:** Design signed off (green-lit) · **Review deck:** [docs/klcsra-proposal.pdf](../../klcsra-proposal.pdf)

Admin-only tool to record a KLC match (football / rugby / variation) — clubs,
per-game squads, score, and every player's stats — total each player's
**Kroopies (KR)** and **MMG points**, produce copy-ready output, feed the balance
sheets, and lock on Submit.

> **v0.3** adds, over v0.2: per-stat KR+MMG payouts; Tackle & re-added Save;
> PF/PA/PDIFF standings; configurable size-tiered points + margin bonus; combined
> (two-half) matches; KR auto-fills loanee amounts; per-match Submit & lock.

## Users & placement

- **Admins only** (staff), at `/admin/klc/matches` in the admin shell. A helper
  Manager may be handed the device to fill the *live* match but cannot edit a
  **submitted** one.

## Match setup

- **Sport** — Football / Rugby / Variation (drives the stat popup).
- **Date**, **Duration** (typed minutes).
- **Two clubs**, each tagged **Home / Away / Neutral** (per-side role).
- **Score entered per team** (a number; not auto-derived).

## Squads

- **Up to 6 players/side** (fixed 6 slots now; → 11 + subs later). Empty slots
  blank. Players from the full member list, shown **initial + surname**.

## Per-player stats — tap-to-add popup

Tap a stat to record it (running count, tap again to add more, tap count to undo).
**13 stats**, each paying **KR + MMG** (all editable in config):

| Stat | KR | MMG | | Stat | KR | MMG |
|---|--:|--:|---|---|--:|--:|
| Goal | 20 | 500 | | Yellow Card | −10 | −200 |
| Try | 25 | 500 | | Red Card | −20 | −500 |
| Assist | 10 | 200 | | Blue Card | −30 | −1000 |
| Pre-Assist | 5 | 100 | | Late Challenge | −5 | −100 |
| Tackle | 5 | 100 | | Own Goal | −20 | −500 |
| Save | 5 | 200 | | Own Assist | −10 | −200 |
|  |  |  | | Own Pre-Assist | −5 | −100 |

MMG values reuse the app's existing `point_rules` table (goals 500, assists 200,
etc.); KR is a **new** per-stat value (KLC-scoped) since `point_rules` stores MMG
only. Where KLCSRA differs from an existing rule (Tackle, Save) the KLC value wins.

**Sport filter** (config, proposed):
- **Football:** Goal, Ass., PA, Save, YC, RC, BC, LC, OG, OA, OPA
- **Rugby:** Try's, Tackle, Ass., PA, YC, RC, BC, LC
- **Variation:** all

## Standings (all configurable)

- Columns **PF / PA / PDIFF** (Points For / Against / Difference — renamed from
  GF/GA/GD). Per-player Goals/Ass/PA leaderboard is unchanged.
- **Size-tiered points** by total players in the match: **≥6 → Win 3 / Draw 1 /
  Loss 0**; **<6 → Win 0.2 / Draw 0.05 / Loss 0**.
- **Margin bonus:** win by **≥20 → +1** winner, **−1** loser.

## Combined match (two halves)

Two **sides carry across both halves**; each half is a normal 1-v-1 with its own
clubs, score and stats. Points: **each half-win = 0.2** to the winning club;
**aggregate-score winner = +0.1** to *both* its clubs. (Worked example: KL+BOCI vs
DP+SOG → KL 0.3, BOCI 0.1, SOG 0.2, DP 0.) A normal match is a single game.

## Finalise — Submit & lock

Autosave while entering; a per-match **Submit** computes all KR/MMG and locks the
match **read-only**. Only **coach / super_admin** may reopen. `Done` on the stats
popup only closes that popup — it is not Submit.

## Outputs

1. **Per-match report** (copy-as-text): sport · duration · date, per-side score,
   and each player's stat line + **+KR / MMG**.
2. **Season leaderboards** — scorers (G/T/Ass/PA), discipline (YC/RC/BC/LC),
   own-goals, saves/tackles, and KR/MMG boards.
3. **Standings** — P, W, D, L, PF, PA, PDIFF, Pts (size-tiered rule + margin).

## Balance Sheet integration (option 1, extended)

On Submit, each club's dated balance entry is filled and locked:
- **Results** (played/W/D/L, from the entered score) → read-only "from match".
- **KR** each player earned → **auto-fills that player's loanee amount** for the
  club they played for (merges additively). *Unit to confirm: whether stat-KR is
  the final KR or the pre-`loaneePerShare` share number.*
- Manager is left owning only **Club Bonus**.
- One-way (recorder → sheet). **MMG** totals are shown to copy into MMG (direct
  write-back is a later, optional phase).

## UI conventions

Single scrolling sheet, `max-w-md`, glass header (Date/Sport/Duration), Home then
Away team cards (club + role + score + 6 slots), `＋ Next match`, then **Submit**.
Autosave + Sync badge. Stats popup = `ui/dialog` or `ui/sheet`. Matches page =
per-date fixtures list (schedule ahead or add as the session runs).

## Open (minor — won't block build)

- Exact website-report wording.
- Confirm the sport → stat lists.
- KR unit into the loanee row (final vs share).
- Leaderboard scope (league-wide / per-club / per-sport).

## Next step

`superpowers:writing-plans` → implementation plan (data model + RLS for
match / half / side / appearance / stat + KR·MMG rate config, reusing clubs,
players and `point_rules`; recorder + stats popup; Submit/lock; payouts; reports;
season tables; balance-sheet link), TDD per bead.
