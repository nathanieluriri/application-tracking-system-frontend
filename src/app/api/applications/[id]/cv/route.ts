import { withEnvelope } from "@server/http/with-envelope";
import { AppError, ErrorCode } from "@server/core/errors";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import { retrieveApplication } from "@server/services/applications";
import { fetchDocument } from "@server/services/documents";

export const GET = withEnvelope(
  async (req, ctx) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/applications/{application_id}/cv");
    const { id } = await ctx.params;
    const application = await retrieveApplication(String(id));
    if (!application.cv_document_id) {
      throw new AppError({
        status: 404,
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: "CV not attached to this application",
      });
    }
    const { document, downloadUrl } = await fetchDocument(application.cv_document_id);
    return { document, download_url: downloadUrl };
  },
  { message: "CV download URL fetched" },
);
