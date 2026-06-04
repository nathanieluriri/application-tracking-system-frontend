import { AppError, ErrorCode, resourceNotFound } from "@server/core/errors";
import { nowSeconds } from "@server/schemas/common";
import { DocumentStorageManager } from "@server/core/storage/manager";
import { createDocument, getDocumentById, deleteDocument } from "@server/repositories/documents";
import type {
  CompleteUploadRequest,
  DocumentOut,
  UploadIntentRequest,
} from "@server/schemas/documents";
import type { UploadIntent } from "@server/core/storage/types";

/**
 * Document business logic, mirrors `services/document_service.py`.
 */

const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50 MB

export function createUploadIntent(ownerId: string, payload: UploadIntentRequest): UploadIntent {
  const provider = DocumentStorageManager.getInstance();
  return provider.createUploadIntent({
    ownerId,
    fileName: payload.file_name,
    mimeType: payload.mime_type,
    size: payload.size,
  });
}

export async function completeUpload(
  ownerId: string,
  payload: CompleteUploadRequest,
): Promise<DocumentOut> {
  if (payload.size > MAX_DOCUMENT_SIZE) {
    throw new AppError({
      status: 413,
      code: ErrorCode.DOCUMENT_UPLOAD_INVALID,
      message: "File too large",
      details: { max_size_bytes: MAX_DOCUMENT_SIZE },
    });
  }

  const provider = DocumentStorageManager.getInstance();
  const stored = provider.completeUpload({
    objectKey: payload.object_key,
    metadata: {
      ownerId,
      fileName: payload.file_name,
      mimeType: payload.mime_type,
      size: payload.size,
    },
    checksum: payload.checksum ?? null,
  });

  return createDocument({
    owner_id: ownerId,
    file_name: payload.file_name,
    object_key: stored.objectKey,
    backend: stored.backend,
    mime_type: stored.mimeType,
    size: stored.size,
    checksum: stored.checksum,
    status: "ready",
    metadata: payload as unknown as Record<string, unknown>,
    created_at: nowSeconds(),
    updated_at: nowSeconds(),
  });
}

export async function fetchDocument(
  documentId: string,
): Promise<{ document: DocumentOut; downloadUrl: string }> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw resourceNotFound("Document", documentId);
  const provider = DocumentStorageManager.getInstance();
  return { document: doc, downloadUrl: provider.downloadUrl(doc.object_key) };
}

export async function removeDocument(documentId: string): Promise<boolean> {
  const doc = await getDocumentById(documentId);
  if (!doc) throw resourceNotFound("Document", documentId);
  const provider = DocumentStorageManager.getInstance();
  await provider.deleteObject(doc.object_key);
  const deleted = await deleteDocument(documentId);
  if (!deleted) throw resourceNotFound("Document", documentId);
  return true;
}
