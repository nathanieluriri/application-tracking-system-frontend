import { DocumentStorageManager } from "@server/core/storage/manager";
import { LocalStorageProvider } from "@server/core/storage/local-provider";

/**
 * Two-phase local upload target (client POSTs the file after an upload intent).
 * Mirrors the FastAPI `POST /v1/documents/upload-local/{key}`.
 */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (key.includes("..")) return new Response(null, { status: 400 });

  const provider = DocumentStorageManager.getInstance();
  if (!(provider instanceof LocalStorageProvider)) return new Response(null, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new Response(null, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  await provider.saveBytes(key, bytes);
  return new Response(null, { status: 204 });
}
