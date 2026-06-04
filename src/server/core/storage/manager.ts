import { getSettings } from "@server/core/settings";
import { LocalStorageProvider } from "./local-provider";
import type { StorageProvider } from "./types";

/**
 * Storage provider singleton, mirrors `core/storage/manager.py`. Defaults to
 * local disk; S3 is opt-in via STORAGE_BACKEND=s3 (lazily loaded so the AWS SDK
 * is not required to boot).
 */
export class DocumentStorageManager {
  private static instance: StorageProvider | null = null;

  static configure(provider: StorageProvider): StorageProvider {
    DocumentStorageManager.instance = provider;
    return provider;
  }

  static configureFromSettings(): StorageProvider {
    const settings = getSettings();
    if (settings.storageBackend === "s3") {
      if (!settings.s3BucketName) {
        throw new Error("S3_BUCKET_NAME is required when STORAGE_BACKEND=s3");
      }
      // S3 provider is added in the documents module; until then, fail loudly
      // rather than silently writing nowhere.
      throw new Error("S3 storage backend is not yet wired; use STORAGE_BACKEND=local");
    }
    return DocumentStorageManager.configure(new LocalStorageProvider(settings.storageLocalRoot));
  }

  static getInstance(): StorageProvider {
    if (DocumentStorageManager.instance === null) {
      return DocumentStorageManager.configureFromSettings();
    }
    return DocumentStorageManager.instance;
  }
}
