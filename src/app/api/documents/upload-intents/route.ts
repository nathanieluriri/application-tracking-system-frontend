import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { requireAny } from "@server/http/guards";
import { uploadIntentRequestSchema } from "@server/schemas/documents";
import { createUploadIntent } from "@server/services/documents";

export const POST = withEnvelope(
  async (req) => {
    const principal = await requireAny(req);
    const payload = await parseJsonBody(req, uploadIntentRequestSchema);
    const intent = createUploadIntent(principal.userId, payload);
    return {
      object_key: intent.objectKey,
      upload_url: intent.uploadUrl,
      expires_in: intent.expiresIn,
      method: intent.method,
      headers: intent.headers ?? null,
    };
  },
  { message: "Upload intent created", status: 201 },
);
