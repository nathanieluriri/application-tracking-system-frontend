import crypto from "node:crypto";
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { createInvitationRecord } from "@server/repositories/invitations";
import { invitationCreateDoc } from "@server/schemas/invitations";
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  verifyInvitationToken,
  acceptInvitation,
} from "@server/services/invitations";
import { authenticateAdmin } from "@server/services/admins";

const NOW = () => Math.floor(Date.now() / 1000);

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf-8").digest("hex");
}

/** Seed a pending invitation with a known raw token (the service stores it hashed). */
async function seedInvitation(opts: {
  rawToken: string;
  inviterId?: string;
  email?: string;
  expiresAt?: number;
}) {
  return createInvitationRecord(
    invitationCreateDoc({
      invitee_email: opts.email ?? "invitee@example.com",
      invited_by: opts.inviterId ?? newId(),
      token_hash: hashToken(opts.rawToken),
      expires_at: opts.expiresAt ?? NOW() + 3600,
    }),
  );
}

describe("invitation service", () => {
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

  it("creates a pending invitation", async () => {
    const inviterId = newId();
    const created = await createInvitation(
      { invitee_email: "new-admin@example.com", note: "join us" },
      inviterId,
      "Ada Lovelace",
    );
    expect(created.id).toBeTruthy();
    expect(created.status).toBe("pending");
    expect(created.invited_by).toBe(inviterId);
    expect(created.role).toBe("admin");
    expect(created.token_hash).toBeTruthy();
    expect(created.expires_at).toBeGreaterThan(NOW());
  });

  it("lists only the requesting admin's invitations when mine_only", async () => {
    const mine = newId();
    const other = newId();
    await createInvitation({ invitee_email: "a@example.com" }, mine);
    await createInvitation({ invitee_email: "b@example.com" }, other);

    const onlyMine = await listInvitations({ inviterId: mine });
    expect(onlyMine).toHaveLength(1);
    expect(onlyMine[0].invited_by).toBe(mine);

    const all = await listInvitations({ inviterId: null });
    expect(all).toHaveLength(2);
  });

  it("verifies a valid token and rejects unknown / expired ones", async () => {
    const rawToken = "raw-token-abcdef1234567890";
    await seedInvitation({ rawToken, email: "verify@example.com" });
    const verified = await verifyInvitationToken(rawToken);
    expect(verified.invitee_email).toBe("verify@example.com");
    expect(verified.role).toBe("admin");

    await expect(verifyInvitationToken("does-not-exist-token")).rejects.toMatchObject({
      status: 404,
    });

    const expiredToken = "expired-token-abcdef1234567890";
    await seedInvitation({ rawToken: expiredToken, expiresAt: NOW() - 10 });
    await expect(verifyInvitationToken(expiredToken)).rejects.toMatchObject({ status: 410 });
  });

  it("accepts an invitation, creating an authenticatable admin", async () => {
    const rawToken = "accept-token-abcdef1234567890";
    await seedInvitation({ rawToken, email: "accept@example.com" });

    const newAdmin = await acceptInvitation({
      token: rawToken,
      full_name: "Grace Hopper",
      password: "pw12345678",
    });
    expect(newAdmin.id).toBeTruthy();
    expect(newAdmin.email).toBe("accept@example.com");
    expect(newAdmin.access_token).toBeTruthy();
    expect(newAdmin.permissionList?.permissions?.[0]?.key).toBe("*");

    // The created admin can authenticate with the chosen password.
    const ok = await authenticateAdmin({ email: "accept@example.com", password: "pw12345678" });
    expect(ok.access_token).toBeTruthy();

    // Token is now consumed: a second accept reports it is no longer pending (410).
    await expect(
      acceptInvitation({ token: rawToken, full_name: "Dup", password: "pw12345678" }),
    ).rejects.toMatchObject({ status: 410 });
  });

  it("revokes a pending invitation and refuses revoking again", async () => {
    const created = await createInvitation({ invitee_email: "revoke@example.com" }, newId());
    const revoked = await revokeInvitation(created.id!);
    expect(revoked.status).toBe("revoked");

    // Already revoked -> no pending match -> 404.
    await expect(revokeInvitation(created.id!)).rejects.toMatchObject({ status: 404 });
    // Invalid id -> 400.
    await expect(revokeInvitation("not-an-id")).rejects.toMatchObject({ status: 400 });
  });
});
