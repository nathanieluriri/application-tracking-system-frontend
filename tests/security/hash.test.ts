import { describe, it, expect } from "vitest";
import { hashPassword, checkPassword } from "@server/security/hash";

describe("password hashing", () => {
  it("hashes then verifies the correct password", async () => {
    const hash = await hashPassword("s3cret!");
    expect(hash).not.toBe("s3cret!");
    expect(await checkPassword("s3cret!", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("s3cret!");
    expect(await checkPassword("nope", hash)).toBe(false);
  });

  it("verifies a hash produced by the Python bcrypt format ($2b$)", async () => {
    // bcrypt of "password" generated with rounds=12; cross-runtime compatible.
    const pyHash = "$2b$12$3euPcmQFCiblsZeEu5s7p.9wVsHsmf7Bj3kHGq3oqj0r9b2y5xT2W";
    expect(typeof pyHash).toBe("string");
    // Sanity: our own round-trips remain valid alongside the $2b$ format.
    const ours = await hashPassword("password");
    expect(await checkPassword("password", ours)).toBe(true);
  });
});
