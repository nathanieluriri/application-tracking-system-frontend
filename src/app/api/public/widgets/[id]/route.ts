import { NextResponse } from "next/server";
import { successEnvelope, errorEnvelope } from "@server/core/response-envelope";
import { isAppError } from "@server/core/errors";
import { retrieveWidgetPublicData } from "@server/services/widgets";

/**
 * Public, cross-origin widget data — the endpoint the embeddable widget.js
 * fetches from any external site. No auth/cookies. Open roles are already
 * public, so the payload carries no secret. CORS is opened ONLY here (the rest
 * of the API stays same-origin); it calls the in-process service directly.
 */

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "public, max-age=60, s-maxage=60",
};

export function OPTIONS(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS, "Cache-Control": "public, max-age=3600" },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const data = await retrieveWidgetPublicData(String(id));
    return NextResponse.json(successEnvelope(data, "Widget data fetched successfully"), {
      headers: CORS,
    });
  } catch (err) {
    if (isAppError(err)) {
      return NextResponse.json(
        errorEnvelope(err.message, { code: err.code, details: err.details ?? null }),
        { status: err.status, headers: CORS },
      );
    }
    return NextResponse.json(
      errorEnvelope("Internal Server Error", { code: "INTERNAL_ERROR", details: null }),
      { status: 500, headers: CORS },
    );
  }
}
