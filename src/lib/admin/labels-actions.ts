"use server";
import { requireEditor } from "@/lib/auth/guard";
import { EDITABLE_PATHS } from "@/content/string-paths";
import { upsertLabelOverride, deleteLabelOverride } from "./labels-repository";

type Result = { ok: true } | { ok: false; error: string };
const VALID = new Set(EDITABLE_PATHS);

export async function setLabelOverride(path: string, value: string): Promise<Result> {
  try {
    const player = await requireEditor();
    if (!VALID.has(path)) return { ok: false, error: "Unknown label." };
    await upsertLabelOverride(path, value, player.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function clearLabelOverride(path: string): Promise<Result> {
  try {
    await requireEditor();
    await deleteLabelOverride(path);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
