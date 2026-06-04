import { cacheGet, cacheSet, cacheDelete } from "@server/core/cache";
import { getSettingsDoc, upsertSettings } from "@server/repositories/settings";
import { defaultSettings, type SettingsOut, type SettingsUpdateInput } from "@server/schemas/settings";

/**
 * Settings business logic, mirrors `services/setting_service.py` (Redis cache
 * replaced by the in-process TTL cache).
 */

const SETTINGS_CACHE_KEY = "settings:singleton";
const SETTINGS_CACHE_TTL = 60;

export async function retrieveSettings(): Promise<SettingsOut> {
  const cached = cacheGet<SettingsOut>(SETTINGS_CACHE_KEY);
  if (cached) return cached;

  const doc = (await getSettingsDoc()) ?? defaultSettings();
  cacheSet(SETTINGS_CACHE_KEY, doc, SETTINGS_CACHE_TTL);
  return doc;
}

export async function saveSettings(payload: SettingsUpdateInput): Promise<SettingsOut> {
  const updated = await upsertSettings(payload);
  cacheDelete(SETTINGS_CACHE_KEY);
  return updated;
}
