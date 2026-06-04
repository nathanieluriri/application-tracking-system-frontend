import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { type Db } from "mongodb";
import { startTestDb, stopTestDb, clearDb } from "../helpers/db";
import { newId, toObjectId } from "../helpers/fixtures";
import { closeDb } from "@server/core/database";
import { EmailManager } from "@server/core/email/manager";
import { addEmailTemplate } from "@server/services/email-templates";
import {
  composeAndSend,
  listOutboundEmails,
  outboundStats,
  handleResendWebhookEvent,
} from "@server/services/outbound-emails";

describe("outbound-email service", () => {
  let db: Db;
  beforeAll(async () => {
    db = await startTestDb();
    // Pick up the console transport from the test env (EMAIL_TRANSPORT=console).
    EmailManager.reset();
  });
  afterEach(async () => {
    await clearDb(db);
  });
  afterAll(async () => {
    await closeDb();
    await stopTestDb();
  });

  it("composeAndSend creates a record per recipient with interpolated content", async () => {
    const sender = newId();
    const records = await composeAndSend(
      {
        subject: "Hello {{name}}",
        html_body: "<p>Hi {{name}}, applying for {{position}}</p>",
        recipients: [
          { email: "alice@example.com", name: "Alice", position: "Engineer" },
          { email: "bob@example.com", name: "Bob", position: "Designer" },
        ],
      },
      sender,
    );

    expect(records).toHaveLength(2);
    expect(records[0].sender_admin_id).toBe(sender);
    expect(records[0].subject_snapshot).toBe("Hello Alice");
    expect(records[0].body_snapshot).toBe("<p>Hi Alice, applying for Engineer</p>");
    expect(records[1].subject_snapshot).toBe("Hello Bob");
    expect(records[0].idempotency_key).toMatch(/^outbound:/);

    // The records are persisted and, via the inline queue + ConsoleTransport,
    // end up marked "sent" by the batch task.
    const persisted = await listOutboundEmails({ sender_admin_id: sender });
    expect(persisted).toHaveLength(2);
    expect(persisted.every((r) => r.status === "sent")).toBe(true);
  });

  it("composeAndSend snapshots template subject/body when template_id is given", async () => {
    const template = await addEmailTemplate(
      { name: "Welcome", subject: "Welcome aboard", html_body: "<p>Welcome to the team</p>" },
      newId(),
    );
    const records = await composeAndSend(
      {
        template_id: template.id!,
        recipients: [{ email: "carol@example.com", name: "Carol" }],
      },
      newId(),
    );
    expect(records).toHaveLength(1);
    expect(records[0].template_id).toBe(template.id);
    expect(records[0].subject_snapshot).toBe("Welcome aboard");
    expect(records[0].body_snapshot).toBe("<p>Welcome to the team</p>");
  });

  it("rejects an empty recipient list", async () => {
    await expect(
      composeAndSend({ subject: "x", html_body: "<p>x</p>", recipients: [] }, newId()),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects when neither template nor subject+body are provided", async () => {
    await expect(
      composeAndSend({ recipients: [{ email: "d@example.com" }] }, newId()),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("404s for a missing template and 400s for an invalid template id", async () => {
    await expect(
      composeAndSend(
        { template_id: newId(), recipients: [{ email: "e@example.com" }] },
        newId(),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      composeAndSend(
        { template_id: "not-an-id", recipients: [{ email: "e@example.com" }] },
        newId(),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("listOutboundEmails filters by sender and application", async () => {
    const senderA = newId();
    const senderB = newId();
    const appId = newId();
    await composeAndSend(
      {
        subject: "A",
        html_body: "<p>A</p>",
        recipients: [{ email: "a1@example.com", application_id: appId }],
      },
      senderA,
    );
    await composeAndSend(
      { subject: "B", html_body: "<p>B</p>", recipients: [{ email: "b1@example.com" }] },
      senderB,
    );

    const bySender = await listOutboundEmails({ sender_admin_id: senderA });
    expect(bySender).toHaveLength(1);
    expect(bySender[0].sender_admin_id).toBe(senderA);

    const byApp = await listOutboundEmails({ application_id: appId });
    expect(byApp).toHaveLength(1);
    expect(byApp[0].application_id).toBe(appId);
  });

  it("outboundStats aggregates sent/delivered counts and delivery rate", async () => {
    await composeAndSend(
      {
        subject: "S",
        html_body: "<p>S</p>",
        recipients: [{ email: "s1@example.com" }, { email: "s2@example.com" }],
      },
      newId(),
    );

    const stats = await outboundStats();
    // Both records are sent via ConsoleTransport (counted as total_sent), and
    // none are delivered yet so the delivery rate is 0.
    expect(stats.total_sent).toBe(2);
    expect(stats.this_week).toBe(2);
    expect(stats.delivery_rate).toBe(0);
  });

  it("handleResendWebhookEvent updates a record's status by resend id", async () => {
    const records = await composeAndSend(
      { subject: "W", html_body: "<p>W</p>", recipients: [{ email: "w1@example.com" }] },
      newId(),
    );
    const recordId = records[0].id!;
    // Stamp a resend id on the persisted record so the webhook can match it.
    const resendId = "re_test_123";
    await db
      .collection("outbound_emails")
      .updateOne({ _id: toObjectId(recordId) }, { $set: { resend_email_id: resendId } });

    const handled = await handleResendWebhookEvent({
      type: "email.delivered",
      data: { email_id: resendId },
    });
    expect(handled).toBe(true);

    const after = await listOutboundEmails({});
    const updated = after.find((r) => r.id === recordId);
    expect(updated?.status).toBe("delivered");
    expect(updated?.delivered_at).toBeTruthy();

    // Unknown event types are ignored.
    const ignored = await handleResendWebhookEvent({ type: "email.unknown", data: { email_id: resendId } });
    expect(ignored).toBe(false);
  });
});
