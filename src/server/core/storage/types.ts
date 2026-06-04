export enum StorageBackend {
  LOCAL = "local",
  S3 = "s3",
}

export interface DocumentMetadata {
  ownerId: string;
  fileName: string;
  mimeType: string;
  size: number;
  extra?: Record<string, unknown>;
}

export interface UploadIntent {
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
  method: string;
  headers?: Record<string, string>;
}

export interface StoredDocument {
  objectKey: string;
  backend: StorageBackend;
  mimeType: string;
  size: number;
  checksum: string | null;
  createdAt: string;
}

export interface StorageProvider {
  backendName: string;
  createUploadIntent(metadata: DocumentMetadata): UploadIntent;
  completeUpload(args: {
    objectKey: string;
    metadata: DocumentMetadata;
    checksum?: string | null;
  }): StoredDocument;
  downloadUrl(objectKey: string, expiresIn?: number): string;
  deleteObject(objectKey: string): Promise<void>;
  saveBytes(objectKey: string, payload: Uint8Array): Promise<number>;
  readBytes(objectKey: string): Promise<Buffer>;
}
