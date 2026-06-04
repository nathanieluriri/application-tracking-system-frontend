import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { resetResendDomainsClient } from "@server/core/email/resend-domains";
import {
  createDomainForOrg,
  deleteDomainForOrg,
  listDomainsForOrg,
  refreshDomainForOrg,
  verifyDomainForOrg,
} from "@server/services/sender-domains";

const ORG = "singleton";

describe("sender-domain service (Resend stub mode)", () => {
  let db: Db;

  beforeAll(async () => {
    // No RESEND_API_KEY -> the Resend domains client runs in stub mode.
    delete process.env.RESEND_API_KEY;
    resetResendDomainsClient();
    db = await startTestDb();
  });
  afterEach(async () => {
    await clearDb(db);
    resetResendDomainsClient();
  });
  afterAll(async () => {
    await closeDb();
    await stopTestDb();
  });

  it("creates a domain (stub) with a synthetic Resend id and pending status", async () => {
    const created = await createDomainForOrg(ORG, newId(), {
      domain: "send.acme.com",
      region: "us-east-1",
    });

    expect(created.id).toBeTruthy();
    expect(created.org_id).toBe(ORG);
    expect(created.domain).toBe("send.acme.com");
    expect(created.resend_domain_id).toBeTruthy();
    expect(created.region).toBe("us-east-1");
    // stub create returns Resend status "not_started" -> normalized to "pending"
    expect(created.status).toBe("pending");
    expect(created.verified_at).toBeNull();
    expect(created.dns_records.length).toBeGreaterThan(0);
    expect(created.dns_records.some((r) => r.type === "MX")).toBe(true);
  });

  it("defaults the region to us-east-1 when omitted", async () => {
    const created = await createDomainForOrg(ORG, null, { domain: "mail.acme.com" });
    expect(created.region).toBe("us-east-1");
  });

  it("rejects a duplicate domain for the same org with a 409", async () => {
    await createDomainForOrg(ORG, null, { domain: "send.acme.com" });
    await expect(
      createDomainForOrg(ORG, null, { domain: "send.acme.com" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("lists an org's domains newest-first", async () => {
    await createDomainForOrg(ORG, null, { domain: "a.acme.com" });
    await createDomainForOrg(ORG, null, { domain: "b.acme.com" });
    const items = await listDomainsForOrg(ORG);
    expect(items).toHaveLength(2);
    // scoped to org only
    expect(items.every((d) => d.org_id === ORG)).toBe(true);
  });

  it("verifies a domain (stub) and marks it verified with a verified_at timestamp", async () => {
    const created = await createDomainForOrg(ORG, null, { domain: "send.acme.com" });
    const verified = await verifyDomainForOrg(ORG, created.id!);

    // stub getDomain reports "verified" after verify is triggered
    expect(verified.status).toBe("verified");
    expect(verified.verified_at).toBeTypeOf("number");

    // persisted
    const [persisted] = await listDomainsForOrg(ORG);
    expect(persisted.status).toBe("verified");
  });

  it("refreshes (GET) a domain by re-fetching status from Resend", async () => {
    const created = await createDomainForOrg(ORG, null, { domain: "send.acme.com" });
    const refreshed = await refreshDomainForOrg(ORG, created.id!);
    // stub getDomain returns "verified"
    expect(refreshed.status).toBe("verified");
    expect(refreshed.id).toBe(created.id);
  });

  it("removes a domain", async () => {
    const created = await createDomainForOrg(ORG, null, { domain: "send.acme.com" });
    expect(await deleteDomainForOrg(ORG, created.id!)).toBe(true);
    expect(await listDomainsForOrg(ORG)).toHaveLength(0);
  });

  it("404s verifying/refreshing/removing an unknown id", async () => {
    const ghost = newId();
    await expect(verifyDomainForOrg(ORG, ghost)).rejects.toMatchObject({ status: 404 });
    await expect(refreshDomainForOrg(ORG, ghost)).rejects.toMatchObject({ status: 404 });
    await expect(deleteDomainForOrg(ORG, ghost)).rejects.toMatchObject({ status: 404 });
  });
});
