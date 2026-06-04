import { type JobProvider, InlineJobProvider } from "./provider";

/**
 * Singleton access to the configured job provider, mirrors `QueueManager` in
 * `core/queue/manager.py`. Defaults to an inline (fire-and-forget) provider so
 * request handlers can `enqueue` without any broker configured.
 */
export class QueueManager {
  private static provider: JobProvider = new InlineJobProvider(false);
  private static tasksRegistered = false;

  static configure(provider: JobProvider): void {
    QueueManager.provider = provider;
  }

  /**
   * Idempotently register the app's task handlers on first use. Runs on the
   * Node route path (never instrumentation/edge), so the mongodb/nodemailer
   * chain stays in the Node bundle where it is externalized.
   */
  private static async ensureTasksRegistered(): Promise<void> {
    if (QueueManager.tasksRegistered) return;
    QueueManager.tasksRegistered = true;
    try {
      const { registerAllTasks } = await import("./tasks");
      registerAllTasks();
    } catch {
      // tasks already registered (e.g. by the test setup) — ignore.
    }
  }

  static getInstance(): JobProvider {
    return QueueManager.provider;
  }

  /** Convenience: enqueue without ever throwing into the caller. */
  static async enqueueSafely(taskKey: string, payload: unknown): Promise<void> {
    try {
      await QueueManager.ensureTasksRegistered();
      await QueueManager.provider.enqueue(taskKey, payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[queue] enqueue '${taskKey}' failed:`, err);
    }
  }
}
