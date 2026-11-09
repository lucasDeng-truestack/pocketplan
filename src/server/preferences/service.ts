import "server-only";
import { db } from "@/server/db";
import { COLOR_MODES, THEMES, type Preferences } from "@/lib/types";

export const DEFAULT_PREFERENCES: Preferences = { theme: "modern", mode: "system" };

/** Defaults when no row exists; each field falls back on its own if the stored string is not a known value. */
export async function getPreferences(userId: string): Promise<Preferences> {
  const row = await db.preference.findUnique({ where: { userId } });
  return {
    theme: THEMES.find((t) => t === row?.theme) ?? DEFAULT_PREFERENCES.theme,
    mode: COLOR_MODES.find((m) => m === row?.mode) ?? DEFAULT_PREFERENCES.mode,
  };
}

/** Callers validate with preferencesSchema first (the action does). */
export async function setPreferences(userId: string, prefs: Preferences): Promise<void> {
  const data = { theme: prefs.theme, mode: prefs.mode };
  await db.preference.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}
