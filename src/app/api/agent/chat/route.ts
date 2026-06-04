import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { requireAdmin } from "@server/http/guards";
import { getSettings } from "@server/core/settings";
import { getRegistry } from "@server/agent/tools";
import { runTurn } from "@server/agent/orchestrator";
import { createGeminiCall } from "@server/agent/llm/gemini";

const bodySchema = z.object({
  message: z.string().optional(),
  conversationId: z.string().optional(),
  confirmToken: z.string().optional(),
  mode: z.enum(["confirm_everything", "smart", "auto_run"]).optional(),
});

export const POST = withEnvelope(
  async (req) => {
    const principal = await requireAdmin(req);
    const body = await parseJsonBody(req, bodySchema);
    const settings = getSettings();

    const geminiCall = settings.geminiApiKey
      ? createGeminiCall({ apiKey: settings.geminiApiKey })
      : undefined;

    return runTurn(
      {
        message: body.message,
        conversationId: body.conversationId,
        confirmToken: body.confirmToken,
        mode: body.mode ?? "smart",
      },
      { userId: principal.userId, req },
      {
        registry: getRegistry(),
        checkPermission: (r, key) => checkAdminAccountStatusAndPermissions(r, key),
        secret: settings.secretKey,
        geminiCall,
      },
    );
  },
  { message: "OK" },
);
