import { createHmac, timingSafeEqual } from "node:crypto";

export interface ConfirmPayload {
  tool: string;
  args: Record<string, unknown>;
  userId: string;
}

interface SignedBody extends ConfirmPayload {
  exp: number; // unix seconds
}

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}
function fromB64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}
function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signConfirmToken(
  payload: ConfirmPayload,
  secret: string,
  ttlSeconds: number,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body: SignedBody = { ...payload, exp };
  const encoded = b64url(JSON.stringify(body));
  const sig = sign(encoded, secret);
  return `${encoded}.${sig}`;
}

export type VerifyResult =
  | { ok: true; payload: ConfirmPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "wrong_user" };

export function verifyConfirmToken(
  token: string,
  secret: string,
  expectedUserId: string,
): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [encoded, sig] = parts;
  const expected = sign(encoded, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  let body: SignedBody;
  try {
    body = JSON.parse(fromB64url(encoded));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (body.userId !== expectedUserId) return { ok: false, reason: "wrong_user" };
  if (Math.floor(Date.now() / 1000) > body.exp) return { ok: false, reason: "expired" };
  return { ok: true, payload: { tool: body.tool, args: body.args, userId: body.userId } };
}
