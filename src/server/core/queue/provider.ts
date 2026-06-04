import { executeRegisteredTask } from "./registry";

/**
 * Job provider abstraction. `InlineJobProvider` runs the handler immediately
 * (the Mongo-only default — no Celery/Redis broker). A `MongoJobProvider` can
 * be added later for durable background processing without changing call sites.
 */
export interface JobProvider {
  enqueue(taskKey: string, payload: unknown): Promise<void> | void;
}

export class InlineJobProvider implements JobProvider {
  /**
   * @param waitForCompletion when true (tests), await the handler so assertions
   * can observe its effects. In request context leave false: the handler runs
   * fire-and-forget with errors logged, so the response is not blocked.
   */
  constructor(private readonly waitForCompletion = true) {}

  async enqueue(taskKey: string, payload: unknown): Promise<void> {
    const run = executeRegisteredTask(taskKey, payload).then(
      () => undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.error(`[queue] task '${taskKey}' failed:`, err);
      },
    );
    if (this.waitForCompletion) await run;
  }
}
