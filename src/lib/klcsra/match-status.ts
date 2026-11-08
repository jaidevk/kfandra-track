/** Pure. The words a match's state is shown in, everywhere (list, header, warnings). */
import type { MatchStatus } from "./types";

export function statusLabel(m: {
  status: MatchStatus; isFriendly: boolean;
  homeSentAt: string | null; awaySentAt: string | null;
}): string {
  if (m.status === "submitted") return m.isFriendly ? "Submitted" : "Official";
  if (m.status === "sent") return "Waiting for KFANDRA";
  const sent = Number(m.homeSentAt !== null) + Number(m.awaySentAt !== null);
  return sent === 0 ? "Draft" : `Draft · ${sent} of 2 teams sent`;
}
