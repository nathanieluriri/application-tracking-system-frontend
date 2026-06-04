import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { closeDb } from "@server/core/database";
import { validateCvBytes, banIp, isIpBanned, unbanIp } from "@server/security/abuse-control";

function pdfBytes(): Uint8Array {
  // %PDF magic + filler
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x0a]);
}

describe("abuse control", () => {
  let db: Db;
  beforeAll(async () => {
    db = await startTestDb();
  });
  afterEach(async () => {
    await clearDb(db);
  });
  afterAll(async () => {
    await closeDb();
    await stopTestDb();
  });

  it("accepts a valid PDF CV", () => {
    expect(() => validateCvBytes(pdfBytes(), "application/pdf")).not.toThrow();
  });

  it("rejects an unsupported mime type", () => {
    expect(() => validateCvBytes(pdfBytes(), "image/png")).toThrow();
  });

  it("rejects content whose magic bytes don't match the mime", () => {
    const notPdf = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    expect(() => validateCvBytes(notPdf, "application/pdf")).toThrow();
  });

  it("bans, detects, and unbans an IP", async () => {
    expect(await isIpBanned("1.2.3.4")).toBe(false);
    await banIp("1.2.3.4");
    expect(await isIpBanned("1.2.3.4")).toBe(true);
    await unbanIp("1.2.3.4");
    expect(await isIpBanned("1.2.3.4")).toBe(false);
  });
});
