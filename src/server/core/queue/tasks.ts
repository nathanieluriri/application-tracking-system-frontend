import { registerTaskIfAbsent } from "./registry";
import { EmailManager } from "@server/core/email/manager";
import { isValidObjectId, toObjectId, nowSeconds } from "@server/schemas/common";

/**
 * Central, idempotent registration of the app's background tasks. Called from
 * `instrumentation.ts` at boot and from the test setup. Individual modules
 * replace these no-ops with real implementations by registering earlier, or by
 * importing their own task module which calls `registerTaskIfAbsent` first.
 *
 * Keys mirror the FastAPI task keys enqueued across the services.
 */
export function registerAllTasks(): void {
  registerTaskIfAbsent("dashboard_refresh", async () => {
    // Real implementation lives in the dashboard module (cache warm).
  });
  registerTaskIfAbsent("close_position_cascade", async () => {
    // Closing a position has no cascade side effects yet.
  });
  // Acknowledgement email sent when an application is received (mirrors the
  // FastAPI `send_application_acknowledgement` task in `core/task.py`). Never
  // throws — failures are logged and swallowed so the request is not blocked.
  registerTaskIfAbsent(
    "send_application_acknowledgement",
    async (payload: {
      application_id?: string;
      email?: string;
      full_name?: string;
      position_title?: string;
    }) => {
      try {
        if (!payload?.email) return false;
        const name = payload.full_name ?? "";
        const position = payload.position_title ?? "";
        const manager = EmailManager.getInstance();
        await manager.send({
          to: payload.email,
          subject: `We received your application${position ? ` for ${position}` : ""}`,
          html: `<p>Hi ${name || "there"},</p><p>Thanks for applying${
            position ? ` for the ${position} role` : ""
          }. We have received your application and will be in touch.</p>`,
          text: `Hi ${name || "there"}, thanks for applying${
            position ? ` for the ${position} role` : ""
          }. We have received your application and will be in touch.`,
        });
        return true;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[task:send_application_acknowledgement] failed:", err);
        return false;
      }
    },
  );

  // Status-change notification (mirrors FastAPI `send_status_change_email`). If
  // a `template_id` is provided, the email-template content is used; otherwise a
  // generic status message is sent.
  registerTaskIfAbsent(
    "send_status_change_email",
    async (payload: {
      application_id?: string;
      to_email?: string;
      full_name?: string;
      status?: string;
      template_id?: string | null;
    }) => {
      try {
        if (!payload?.to_email) return false;
        const name = payload.full_name ?? "";
        const status = payload.status ?? "";

        let subject = `Update on your application`;
        let html = `<p>Hi ${name || "there"},</p><p>The status of your application has changed to <strong>${status}</strong>.</p>`;
        let text = `Hi ${name || "there"}, the status of your application has changed to ${status}.`;

        if (payload.template_id && isValidObjectId(payload.template_id)) {
          const { getEmailTemplate } = await import("@server/repositories/email-templates");
          const template = await getEmailTemplate({
            _id: toObjectId(payload.template_id)!,
            deleted_at: { $in: [null, undefined] },
          });
          if (template) {
            subject = template.subject;
            html = template.html_body;
            text = template.text_body ?? template.html_body;
          }
        }

        const manager = EmailManager.getInstance();
        await manager.send({ to: payload.to_email, subject, html, text });
        return true;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[task:send_status_change_email] failed:", err);
        return false;
      }
    },
  );

  // Batch dispatch for composed outbound emails (mirrors FastAPI
  // `send_outbound_email_batch`). Sends each queued record via the EmailManager
  // and stamps the outcome (sent/failed) on the record.
  registerTaskIfAbsent(
    "send_outbound_email_batch",
    async (payload: { record_ids?: string[] }) => {
      const recordIds = payload?.record_ids ?? [];
      if (recordIds.length === 0) return true;
      const { getOutboundRecord, updateOutboundRecord } = await import(
        "@server/repositories/outbound-emails"
      );
      const manager = EmailManager.getInstance();
      for (const recordId of recordIds) {
        if (!isValidObjectId(recordId)) continue;
        const record = await getOutboundRecord({ _id: toObjectId(recordId)! });
        if (!record) continue;
        try {
          const result = await manager.send({
            to: record.to_email,
            subject: record.subject_snapshot,
            html: record.body_snapshot,
            text: record.body_snapshot,
          });
          await updateOutboundRecord(
            { _id: toObjectId(recordId)! },
            { status: "sent", sent_at: nowSeconds(), resend_email_id: result.id },
          );
        } catch (err) {
          await updateOutboundRecord(
            { _id: toObjectId(recordId)! },
            { status: "failed", error: String(err) },
          );
        }
      }
      return true;
    },
  );

  registerTaskIfAbsent("delete_tokens", async () => {
    // Real implementation registered by the auth module if needed.
  });
  registerTaskIfAbsent("send_invitation_email", async () => {
    // Real implementation registered by the email/invitations module.
  });
}
