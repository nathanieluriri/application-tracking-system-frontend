import { DocumentStorageManager } from "@server/core/storage/manager";
import { LocalStorageProvider } from "@server/core/storage/local-provider";

/**
 * Serve a locally-stored object by key (raw bytes, not enveloped). Keys are
 * random/unguessable; mirrors the FastAPI `GET /v1/documents/local/{key}`.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (key.includes("..")) return new Response(null, { status: 400 });

  const provider = DocumentStorageManager.getInstance();
  if (!(provider instanceof LocalStorageProvider)) return new Response(null, { status: 404 });

  try {
    const data = await provider.readBytes(key);
    return new Response(new Uint8Array(data), { status: 200 });
  } catch {
    return new Response(null, { status: 404 });
  }
}
