import { withEnvelope } from "@server/http/with-envelope";
import { authPermissionDenied } from "@server/core/errors";
import { requireAny } from "@server/http/guards";
import { fetchDocument, removeDocument } from "@server/services/documents";

export const GET = withEnvelope(
  async (req, ctx) => {
    const principal = await requireAny(req);
    const { id } = await ctx.params;
    const { document, downloadUrl } = await fetchDocument(String(id));
    if (document.owner_id !== principal.userId && !principal.isAdmin) {
      throw authPermissionDenied("GET:/documents/{document_id}");
    }
    return { document, download_url: downloadUrl };
  },
  { message: "Document fetched" },
);

export const DELETE = withEnvelope(
  async (req, ctx) => {
    const principal = await requireAny(req);
    const { id } = await ctx.params;
    const { document } = await fetchDocument(String(id));
    if (document.owner_id !== principal.userId && !principal.isAdmin) {
      throw authPermissionDenied("DELETE:/documents/{document_id}");
    }
    await removeDocument(String(id));
    return { deleted: true };
  },
  { message: "Document deleted" },
);
