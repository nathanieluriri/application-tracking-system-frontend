import { badRequest, notFound } from "@server/core/errors";
import { isValidObjectId, toObjectId } from "@server/schemas/common";
import {
  createEmailTemplate,
  getEmailTemplate,
  getEmailTemplates,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "@server/repositories/email-templates";
import {
  emailTemplateCreateDoc,
  type EmailTemplateCreateInput,
  type EmailTemplateUpdateInput,
  type EmailTemplateOut,
} from "@server/schemas/email-templates";

/**
 * Email-template business logic, mirrors `services/email_template_service.py`.
 */

export async function addEmailTemplate(
  input: EmailTemplateCreateInput,
  createdBy: string | null,
): Promise<EmailTemplateOut> {
  return createEmailTemplate(emailTemplateCreateDoc(input, createdBy));
}

export async function retrieveEmailTemplates(start = 0, stop = 100): Promise<EmailTemplateOut[]> {
  return getEmailTemplates(start, stop);
}

export async function retrieveEmailTemplateById(id: string): Promise<EmailTemplateOut> {
  if (!isValidObjectId(id)) throw badRequest("Invalid template ID format");
  const result = await getEmailTemplate({ _id: toObjectId(id)! });
  if (!result) throw notFound("Email template not found");
  return result;
}

export async function updateEmailTemplateById(
  id: string,
  data: EmailTemplateUpdateInput,
): Promise<EmailTemplateOut> {
  if (!isValidObjectId(id)) throw badRequest("Invalid template ID format");
  const result = await updateEmailTemplate({ _id: toObjectId(id)! }, data);
  if (!result) throw notFound("Email template not found or update failed");
  return result;
}

export async function removeEmailTemplate(id: string): Promise<{ deleted: boolean }> {
  if (!isValidObjectId(id)) throw badRequest("Invalid template ID format");
  const existing = await getEmailTemplate({ _id: toObjectId(id)! });
  if (!existing) throw notFound("Email template not found");
  if (existing.is_system) throw notFound("System templates cannot be deleted");
  const result = await deleteEmailTemplate({ _id: toObjectId(id)! });
  if (result.deletedCount === 0) throw notFound("Email template not found");
  return { deleted: true };
}
