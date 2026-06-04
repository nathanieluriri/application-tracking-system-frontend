import { DocumentStorageManager } from "@server/core/storage/manager";
import { LocalStorageProvider } from "@server/core/storage/local-provider";
import { getDocumentByKey } from "@server/repositories/documents";

/**
 * Serve a locally-stored object by key. Keys are random/unguessable.
 *
 * Hardening (beyond the FastAPI original): the response Content-Type comes from
 * the stored, allowlisted mime type; `nosniff` + an attachment disposition +
 * a sandbox CSP prevent the browser from interpreting an uploaded file as HTML
 * (stored-XSS via content sniffing).
 */

const SAFE_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 128) || "download";
}

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (key.includes("..") || key.includes("/") || key.includes("\\")) {
    return new Response(null, { status: 400 });
  }

  const provider = DocumentStorageManager.getInstance();
  if (!(provider instanceof LocalStorageProvider)) return new Response(null, { status: 404 });

  let data: Buffer;
  try {
    data = await provider.readBytes(key);
  } catch {
    return new Response(null, { status: 404 });
  }

  const doc = await getDocumentByKey(key);
  const mime = doc && SAFE_MIME.has(doc.mime_type) ? doc.mime_type : "application/octet-stream";
  const filename = safeFilename(doc?.file_name ?? key);

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
