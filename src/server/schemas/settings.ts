import { z } from "zod";
import { nowSeconds } from "./common";

/**
 * Org settings schemas, mirrors `schemas/setting_schema.py` (singleton doc).
 */

export const SINGLETON_KEY = "singleton";

const notificationSettings = z.object({
  new_application: z.boolean().default(true),
  status_changed: z.boolean().default(true),
  interview_reminder: z.boolean().default(true),
  weekly_summary: z.boolean().default(true),
});

const emailSettings = z.object({
  reply_to: z.string().email().nullable().optional(),
  sender_name: z.string().default("HR Team"),
});

const portalSettings = z.object({
  accept_applications: z.boolean().default(true),
  require_cv: z.boolean().default(true),
  auto_acknowledge: z.boolean().default(true),
});

export const settingsUpdateSchema = z.object({
  notifications: notificationSettings.partial().optional(),
  email: emailSettings.partial().optional(),
  portal: portalSettings.partial().optional(),
});
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

export interface SettingsOut {
  org_id: string;
  notifications: {
    new_application: boolean;
    status_changed: boolean;
    interview_reminder: boolean;
    weekly_summary: boolean;
  };
  email: { reply_to: string | null; sender_name: string };
  portal: { accept_applications: boolean; require_cv: boolean; auto_acknowledge: boolean };
  last_updated: number;
}

export function defaultSettings(): SettingsOut {
  return {
    org_id: SINGLETON_KEY,
    notifications: {
      new_application: true,
      status_changed: true,
      interview_reminder: true,
      weekly_summary: true,
    },
    email: { reply_to: null, sender_name: "HR Team" },
    portal: { accept_applications: true, require_cv: true, auto_acknowledge: true },
    last_updated: nowSeconds(),
  };
}

export function settingsOut(doc: Record<string, any>): SettingsOut {
  const base = defaultSettings();
  return {
    org_id: doc.org_id ?? SINGLETON_KEY,
    notifications: { ...base.notifications, ...(doc.notifications ?? {}) },
    email: { ...base.email, ...(doc.email ?? {}) },
    portal: { ...base.portal, ...(doc.portal ?? {}) },
    last_updated: doc.last_updated ?? base.last_updated,
  };
}
