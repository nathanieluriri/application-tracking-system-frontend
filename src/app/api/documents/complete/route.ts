import { withEnvelope } from "@server/http/with-envelope";
import { parseJsonBody } from "@server/http/request";
import { requireAny } from "@server/http/guards";
import { completeUploadRequestSchema } from "@server/schemas/documents";
import { completeUpload } from "@server/services/documents";

export const POST = withEnvelope(
  async (req) => {
    const principal = await requireAny(req);
    const payload = await parseJsonBody(req, completeUploadRequestSchema);
    return completeUpload(principal.userId, payload);
  },
  { message: "Upload completed", status: 201 },
);
