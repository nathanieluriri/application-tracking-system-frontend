import { buildRuntimeScript } from "@/lib/widget/runtime";

/**
 * Serves the embeddable widget runtime at GET /embed/widget.js as a
 * dependency-free IIFE (built from the runtime's own function sources).
 * Public, cross-origin, long-cached + immutable.
 */
export function GET(): Response {
  return new Response(buildRuntimeScript(), {
    status: 200,
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
