import { badRequest, notFound } from "@server/core/errors";
import { isValidObjectId, toObjectId, nowSeconds } from "@server/schemas/common";
import { QueueManager } from "@server/core/queue/manager";
import { getEmailTemplate } from "@server/repositories/email-templates";
import {
  createOutboundRecords,
  getOutboundEmails,
  updateOutboundRecord,
  updateOutboundStatusByResendId,
  countTotalSent,
  countThisWeek,
  deliveryRate,
} from "@server/repositories/outbound-emails";
import {
  outboundEmailCreateDoc,
  type OutboundEmailCreateInput,
  type OutboundEmailOut,
} from "@server/schemas/outbound-emails";

/**
 * Outbound-email business logic, mirrors `services/outbound_email_service.py`.
 * Framework-agnostic — no next/* imports.
 */

const VAR_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

/** Replace `{{key}}` tokens from the recipient context. */
function interpolate(text: string, context: Record<string, string>): string {
  return text.replace(VAR_PATTERN, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(context, key) ? String(context[key]) : match,
  );
}

export async function composeAndSend(
  payload: OutboundEmailCreateInput,
  senderAdminId: string,
): Promise<OutboundEmailOut[]> {
  if (!payload.recipients || payload.recipients.length === 0) {
    throw badRequest("At least one recipient is required");
  }

  let template: { subject: string; html_body: string } | null = null;
  if (payload.template_id) {
    if (!isValidObjectId(payload.template_id)) throw badRequest("Invalid template ID");
    const found = await getEmailTemplate({
      _id: toObjectId(payload.template_id)!,
      deleted_at: { $in: [null, undefined] },
    });
    if (!found) throw notFound("Template not found");
    template = { subject: found.subject, html_body: found.html_body };
  }

  if (!template && (!payload.subject || !payload.html_body)) {
    throw badRequest("Either template_id or subject + html_body are required");
  }

  const baseSubject = template ? template.subject : (payload.subject ?? "");
  const baseBody = template ? template.html_body : (payload.html_body ?? "");

  const docs = payload.recipients.map((recipient) => {
    const context: Record<string, string> = {
      name: recipient.name ?? "",
      email: recipient.email,
      position: recipient.position ?? "",
    };
    const renderedSubject = template ? baseSubject : interpolate(baseSubject, context);
    const renderedBody = template ? baseBody : interpolate(baseBody, context);
    return outboundEmailCreateDoc({
      sender_admin_id: senderAdminId,
      application_id: recipient.application_id ?? null,
      template_id: payload.template_id ?? null,
      to_email: recipient.email,
      to_name: recipient.name ?? null,
      subject_snapshot: renderedSubject,
      body_snapshot: renderedBody,
    });
  });

  const persisted = await createOutboundRecords(docs);

  const chunkSize = 100;
  for (let i = 0; i < persisted.length; i += chunkSize) {
    const chunk = persisted.slice(i, i + chunkSize);
    const ids = chunk.map((r) => r.id).filter((id): id is string => Boolean(id));
    const taskId = `outbound_batch:${ids[0] ?? "empty"}`;
    for (const recordId of ids) {
      if (!isValidObjectId(recordId)) continue;
      await updateOutboundRecord(
        { _id: toObjectId(recordId)! },
        { task_id: taskId, queued_at: nowSeconds(), status: "queued" },
      );
    }
    await QueueManager.enqueueSafely("send_outbound_email_batch", { record_ids: ids });
  }

  await QueueManager.enqueueSafely("dashboard_refresh", {});
  return persisted;
}

export async function listOutboundEmails(opts: {
  sender_admin_id?: string;
  application_id?: string;
  start?: number;
  stop?: number;
}): Promise<OutboundEmailOut[]> {
  const filter: Record<string, unknown> = {};
  if (opts.sender_admin_id) filter.sender_admin_id = opts.sender_admin_id;
  if (opts.application_id) filter.application_id = opts.application_id;
  return getOutboundEmails(filter, opts.start ?? 0, opts.stop ?? 100);
}

export async function outboundStats(): Promise<{
  total_sent: number;
  this_week: number;
  delivery_rate: number;
}> {
  return {
    total_sent: await countTotalSent(),
    this_week: await countThisWeek(),
    delivery_rate: await deliveryRate(),
  };
}

const EVENT_STATUS_MAP: Record<string, [string, string | null]> = {
  "email.sent": ["sent", "sent_at"],
  "email.delivered": ["delivered", "delivered_at"],
  "email.bounced": ["bounced", null],
  "email.complained": ["complained", null],
  "email.failed": ["failed", null],
  "email.opened": ["delivered", "opened_at"],
  "email.clicked": ["delivered", "clicked_at"],
  "email.delivery_delayed": ["queued", null],
};

export async function handleResendWebhookEvent(
  event: Record<string, any>,
): Promise<boolean> {
  const eventType: string | undefined = event.type ?? event.event;
  const data: Record<string, any> = event.data ?? {};
  const resendEmailId: string | undefined = data.email_id ?? data.id;
  if (!resendEmailId) return false;
  if (!eventType || !(eventType in EVENT_STATUS_MAP)) return false;

  const [newStatus, timestampField] = EVENT_STATUS_MAP[eventType];
  const updated = await updateOutboundStatusByResendId(resendEmailId, newStatus, timestampField);
  if (updated) {
    await QueueManager.enqueueSafely("dashboard_refresh", {});
  }
  return updated;
}
