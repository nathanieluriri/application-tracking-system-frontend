import { AppError, ErrorCode } from "@server/core/errors";
import { getDb, COLLECTIONS } from "@server/core/database";
import { hitRateLimit } from "@server/security/rate-limit";

/**
 * Public-submission abuse controls, mirrors `security/abuse_control.py`. The
 * Redis-backed banned-IP set + counters are replaced by a Mongo collection
 * (TTL index) and the Mongo fixed-window limiter.
 */

const MAX_CV_SIZE = 5 * 1024 * 1024; // 5 MB
const SUBMIT_PER_IP_HOUR = 5;
const SUBMIT_PER_IP_DAY = 20;

const ALLOWED_CV_MIMETYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const DOC_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
const DOCX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

let bannedIndexEnsured = false;
async function ensureBannedIndex(): Promise<void> {
  if (bannedIndexEnsured) return;
  const db = await getDb();
  await db.collection(COLLECTIONS.adminLogs); // touch to ensure db
  await db
    .collection("banned_ips")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  bannedIndexEnsured = true;
}

export async function isIpBanned(ip: string): Promise<boolean> {
  try {
    const db = await getDb();
    const row = await db.collection("banned_ips").findOne({ _id: ip as unknown as never });
    return row !== null;
  } catch {
    return false;
  }
}

export async function banIp(ip: string, ttlSeconds = 7 * 24 * 3600): Promise<void> {
  await ensureBannedIndex();
  const db = await getDb();
  await db
    .collection("banned_ips")
    .updateOne(
      { _id: ip as unknown as never },
      { $set: { expiresAt: new Date(Date.now() + ttlSeconds * 1000) } },
      { upsert: true },
    );
}

export async function unbanIp(ip: string): Promise<void> {
  const db = await getDb();
  await db.collection("banned_ips").deleteOne({ _id: ip as unknown as never });
}

function validateMagicBytes(head: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") return head.subarray(0, 4).equals(PDF_MAGIC);
  if (mimeType === "application/msword") return head.subarray(0, 4).equals(DOC_MAGIC);
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return head.subarray(0, 4).equals(DOCX_MAGIC);
  }
  return false;
}

export function validateCvBytes(fileBytes: Uint8Array, mimeType: string): void {
  if (!ALLOWED_CV_MIMETYPES.has(mimeType)) {
    throw new AppError({
      status: 400,
      code: ErrorCode.DOCUMENT_UPLOAD_INVALID,
      message: "Unsupported CV mime type",
      details: { mime_type: mimeType, allowed: [...ALLOWED_CV_MIMETYPES] },
    });
  }
  if (fileBytes.length > MAX_CV_SIZE) {
    throw new AppError({
      status: 413,
      code: ErrorCode.DOCUMENT_UPLOAD_INVALID,
      message: "CV exceeds maximum size",
      details: { max_bytes: MAX_CV_SIZE },
    });
  }
  if (!validateMagicBytes(Buffer.from(fileBytes.subarray(0, 8)), mimeType)) {
    throw new AppError({
      status: 400,
      code: ErrorCode.DOCUMENT_UPLOAD_INVALID,
      message: "CV content does not match declared mime type",
    });
  }
}

export function verifyCaptcha(token: string | null | undefined): void {
  const provider = process.env.CAPTCHA_PROVIDER;
  if (!provider) return;
  if (!token) {
    throw new AppError({
      status: 400,
      code: ErrorCode.VALIDATION_FAILED,
      message: "Captcha token required",
    });
  }
  // Provider-specific verification is intentionally left as an integration point.
}

export async function publicSubmissionGuard(req: Request): Promise<string> {
  const ip = clientIp(req);

  if (await isIpBanned(ip)) {
    throw new AppError({
      status: 403,
      code: ErrorCode.AUTH_PERMISSION_DENIED,
      message: "Submissions from this IP are blocked",
    });
  }

  const hourly = await hitRateLimit(`abuse:ip:${ip}:hour`, {
    amount: SUBMIT_PER_IP_HOUR,
    windowSeconds: 3600,
  });
  const daily = await hitRateLimit(`abuse:ip:${ip}:day`, {
    amount: SUBMIT_PER_IP_DAY,
    windowSeconds: 86400,
  });
  if (!hourly.allowed || !daily.allowed) {
    throw new AppError({
      status: 429,
      code: ErrorCode.TOO_MANY_REQUESTS,
      message: "Too many submissions from this IP",
    });
  }
  return ip;
}
