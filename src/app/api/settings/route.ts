import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { settingsUpdateSchema } from "@server/schemas/settings";
import { retrieveSettings, saveSettings } from "@server/services/settings";

export const GET = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/settings");
    return retrieveSettings();
  },
  { message: "Settings fetched successfully" },
);

export const PUT = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "PUT:/settings");
    const payload = await parseJsonBody(req, settingsUpdateSchema);
    return saveSettings(payload);
  },
  { message: "Settings updated successfully" },
);
