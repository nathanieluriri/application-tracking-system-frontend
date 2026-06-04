/**
 * Response envelope builders, mirrors `core/response_envelope.py`.
 * The exact JSON shape is a wire contract the frontend already parses.
 */

export interface SuccessEnvelope<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  requestId?: string;
}

export interface ErrorEnvelope {
  success: false;
  message: string;
  data: unknown;
  requestId?: string;
}

export interface EnvelopeOptions {
  meta?: Record<string, unknown> | null;
  requestId?: string | null;
}

export function successEnvelope<T>(
  data: T,
  message = "Success",
  opts: EnvelopeOptions = {},
): SuccessEnvelope<T> {
  const payload: SuccessEnvelope<T> = { success: true, message, data };
  if (opts.meta !== undefined && opts.meta !== null) payload.meta = opts.meta;
  if (opts.requestId) payload.requestId = opts.requestId;
  return payload;
}

export function errorEnvelope(
  message: string,
  data: unknown = null,
  opts: EnvelopeOptions = {},
): ErrorEnvelope {
  const payload: ErrorEnvelope = { success: false, message, data };
  if (opts.requestId) payload.requestId = opts.requestId;
  return payload;
}
