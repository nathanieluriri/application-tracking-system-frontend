import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, ErrorCode } from "@server/core/errors";
import { successEnvelope, errorEnvelope } from "@server/core/response-envelope";
import { getSettings } from "@server/core/settings";
import { getRequestId } from "./request";

/**
 * Wraps a route handler so its return value becomes the success envelope and
 * thrown errors become the error envelope. The TS analogue of the FastAPI
 * `@document_response` decorator + global exception handlers.
 *
 * A handler may return a `NextResponse` directly (e.g. to set auth cookies); it
 * is passed through unchanged.
 */

export type RouteContext = { params: Promise<Record<string, string | string[]>> };
export type RouteHandler = (req: Request, ctx: RouteContext) => Promise<unknown> | unknown;

export interface EnvelopeOptions {
  message?: string;
  status?: number;
}

export function withEnvelope(handler: RouteHandler, opts: EnvelopeOptions = {}) {
  return async (req: Request, ctx: RouteContext): Promise<NextResponse> => {
    const requestId = getRequestId(req);
    try {
      const result = await handler(req, ctx);
      if (result instanceof NextResponse) return result;
      const body = successEnvelope(result, opts.message ?? "Success", { requestId });
      return NextResponse.json(body, {
        status: opts.status ?? 200,
        headers: { "X-Request-ID": requestId },
      });
    } catch (err) {
      return errorToResponse(err, requestId);
    }
  };
}

function errorToResponse(err: unknown, requestId: string): NextResponse {
  if (err instanceof AppError) {
    const body = errorEnvelope(
      err.message,
      { code: err.code, details: err.details ?? null },
      { requestId },
    );
    return NextResponse.json(body, {
      status: err.status,
      headers: { "X-Request-ID": requestId, ...(err.headers ?? {}) },
    });
  }

  if (err instanceof ZodError) {
    const body = errorEnvelope(
      "Validation error",
      { code: ErrorCode.VALIDATION_FAILED, details: { errors: err.issues } },
      { requestId },
    );
    return NextResponse.json(body, { status: 422, headers: { "X-Request-ID": requestId } });
  }

  const settings = getSettings();
  const details =
    settings.debugIncludeErrorDetails && !settings.isProduction ? String(err) : null;
  // eslint-disable-next-line no-console
  console.error(`[api] unhandled error (request ${requestId}):`, err);
  const body = errorEnvelope(
    "Internal Server Error",
    { code: ErrorCode.INTERNAL_ERROR, details },
    { requestId },
  );
  return NextResponse.json(body, { status: 500, headers: { "X-Request-ID": requestId } });
}
