import { z } from "zod";
import { withEnvelope } from "@server/http/with-envelope";
import { parseQuery } from "@server/http/request";
import { AppError, ErrorCode } from "@server/core/errors";
import { checkAdminAccountStatusAndPermissions } from "@server/security/account-status";
import {
  publicSubmissionGuard,
  verifyCaptcha,
  validateCvBytes,
} from "@server/security/abuse-control";
import { DocumentStorageManager } from "@server/core/storage/manager";
import { createDocument } from "@server/repositories/documents";
import { nowSeconds } from "@server/schemas/common";
import { publicSubmitSchema } from "@server/schemas/applications";
import { submitApplication, retrieveApplications } from "@server/services/applications";

const listQuerySchema = z.object({
  start: z.coerce.number().int().min(0).optional(),
  stop: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  position_id: z.string().optional(),
  search: z.string().optional(),
});

export const GET = withEnvelope(
  async (req) => {
    await checkAdminAccountStatusAndPermissions(req, "GET:/applications");
    const q = parseQuery(req, listQuerySchema);
    return retrieveApplications(q);
  },
  { message: "Applications fetched successfully" },
);

export const POST = withEnvelope(
  async (req) => {
    const form = await req.formData();

    // Honeypot: silently accept bots without persisting anything.
    if (form.get("website")) return { submitted: true };

    await publicSubmissionGuard(req);
    verifyCaptcha(form.get("captcha_token") as string | null);

    const fields = {
      full_name: form.get("full_name"),
      email: form.get("email"),
      position_id: form.get("position_id"),
      phone: form.get("phone") ?? undefined,
      experience: form.get("experience") ?? undefined,
      location: form.get("location") ?? undefined,
      captcha_token: form.get("captcha_token") ?? undefined,
    };
    const parsed = publicSubmitSchema.safeParse(fields);
    if (!parsed.success) {
      throw new AppError({
        status: 422,
        code: ErrorCode.VALIDATION_FAILED,
        message: "Validation error",
        details: { errors: parsed.error.issues },
      });
    }
    const data = parsed.data;

    let cvDocumentId: string | null = null;
    const cv = form.get("cv");
    if (cv instanceof File && cv.size > 0) {
      const bytes = new Uint8Array(await cv.arrayBuffer());
      validateCvBytes(bytes, cv.type || "");

      const provider = DocumentStorageManager.getInstance();
      const ownerId = `applicant:${data.email}`;
      const metadata = {
        ownerId,
        fileName: cv.name || "cv",
        mimeType: cv.type || "application/pdf",
        size: bytes.length,
      };
      const intent = provider.createUploadIntent(metadata);
      await provider.saveBytes(intent.objectKey, bytes);
      const stored = provider.completeUpload({ objectKey: intent.objectKey, metadata });

      const doc = await createDocument({
        owner_id: ownerId,
        file_name: metadata.fileName,
        object_key: stored.objectKey,
        backend: stored.backend,
        mime_type: stored.mimeType,
        size: stored.size,
        checksum: stored.checksum,
        status: "ready",
        metadata: { source: "public_application" },
        created_at: nowSeconds(),
        updated_at: nowSeconds(),
      });
      cvDocumentId = doc.id;
    }

    return submitApplication({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
      position_id: data.position_id,
      experience: data.experience ?? null,
      location: data.location ?? null,
      cv_document_id: cvDocumentId,
    });
  },
  { message: "Application submitted successfully", status: 201 },
);
