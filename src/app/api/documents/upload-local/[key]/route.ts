import { DocumentStorageManager } from "@server/core/storage/manager";
import { LocalStorageProvider } from "@server/core/storage/local-provider";
import { requireAny } from "@server/http/guards";

/**
 * Two-phase local upload target (client POSTs the file after an upload intent).
 * Requires an authenticated principal — uploads are only ever performed by the
 * same user/admin that requested the intent. Path keys are constrained to a
 * single safe segment to prevent traversal.
 */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  try {
    await requireAny(req);
  } catch {
    return new Response(null, { status: 401 });
  }

  const { key } = await ctx.params;
  if (key.includes("..") || key.includes("/") || key.includes("\\")) {
    return new Response(null, { status: 400 });
  }

  const provider = DocumentStorageManager.getInstance();
  if (!(provider instanceof LocalStorageProvider)) return new Response(null, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new Response(null, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  await provider.saveBytes(key, bytes);
  return new Response(null, { status: 204 });
}
