import { getDb, COLLECTIONS } from "@server/core/database";
import { nowSeconds } from "@server/schemas/common";
import {
  SINGLETON_KEY,
  defaultSettings,
  settingsOut,
  type SettingsOut,
  type SettingsUpdateInput,
} from "@server/schemas/settings";

/**
 * Settings persistence (singleton org doc), mirrors `repositories/setting_repo.py`.
 */

export async function getSettingsDoc(): Promise<SettingsOut | null> {
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.settings).findOne({ org_id: SINGLETON_KEY });
  return doc ? settingsOut(doc) : null;
}

export async function upsertSettings(payload: SettingsUpdateInput): Promise<SettingsOut> {
  const existing = (await getSettingsDoc()) ?? defaultSettings();
  const base: SettingsOut = { ...existing };

  if (payload.notifications) base.notifications = { ...base.notifications, ...payload.notifications };
  if (payload.email) base.email = { ...base.email, ...payload.email };
  if (payload.portal) base.portal = { ...base.portal, ...payload.portal };
  base.last_updated = nowSeconds();
  base.org_id = SINGLETON_KEY;

  const db = await getDb();
  await db
    .collection(COLLECTIONS.settings)
    .updateOne({ org_id: SINGLETON_KEY }, { $set: base }, { upsert: true });
  return base;
}
