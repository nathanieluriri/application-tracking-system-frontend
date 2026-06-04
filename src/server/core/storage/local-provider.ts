import { promises as fs } from "node:fs";
import { join, extname, dirname } from "node:path";
import {
  StorageBackend,
  type DocumentMetadata,
  type StorageProvider,
  type StoredDocument,
  type UploadIntent,
} from "./types";

/**
 * Local-disk storage provider, mirrors `core/storage/local_provider.py`.
 * Files live under `root`; object keys are random and unguessable.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly backendName = StorageBackend.LOCAL;

  constructor(private readonly root: string) {}

  createUploadIntent(metadata: DocumentMetadata): UploadIntent {
    const ext = extname(metadata.fileName);
    const objectKey = `${crypto.randomUUID().replace(/-/g, "")}${ext}`;
    return {
      objectKey,
      uploadUrl: `/api/documents/upload-local/${encodeURIComponent(objectKey)}`,
      expiresIn: 3600,
      method: "POST",
    };
  }

  completeUpload(args: {
    objectKey: string;
    metadata: DocumentMetadata;
    checksum?: string | null;
  }): StoredDocument {
    return {
      objectKey: args.objectKey,
      backend: StorageBackend.LOCAL,
      mimeType: args.metadata.mimeType,
      size: args.metadata.size,
      checksum: args.checksum ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  downloadUrl(objectKey: string): string {
    return `/api/documents/local/${encodeURIComponent(objectKey)}`;
  }

  async deleteObject(objectKey: string): Promise<void> {
    try {
      await fs.unlink(join(this.root, objectKey));
    } catch {
      // already gone
    }
  }

  async saveBytes(objectKey: string, payload: Uint8Array): Promise<number> {
    const filePath = join(this.root, objectKey);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, payload);
    const stat = await fs.stat(filePath);
    return stat.size;
  }

  async readBytes(objectKey: string): Promise<Buffer> {
    return fs.readFile(join(this.root, objectKey));
  }
}
