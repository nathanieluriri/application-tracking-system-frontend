import { type JobProvider, InlineJobProvider } from "./provider";

/**
 * Singleton access to the configured job provider, mirrors `QueueManager` in
 * `core/queue/manager.py`. Defaults to an inline (fire-and-forget) provider so
 * request handlers can `enqueue` without any broker configured.
 */
export class QueueManager {
  private static provider: JobProvider = new InlineJobProvider(false);

  static configure(provider: JobProvider): void {
    QueueManager.provider = provider;
  }

  static getInstance(): JobProvider {
    return QueueManager.provider;
  }

  /** Convenience: enqueue without ever throwing into the caller. */
  static async enqueueSafely(taskKey: string, payload: unknown): Promise<void> {
    try {
      await QueueManager.provider.enqueue(taskKey, payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[queue] enqueue '${taskKey}' failed:`, err);
    }
  }
}
