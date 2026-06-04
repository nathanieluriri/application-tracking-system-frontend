/**
 * In-process task registry, mirrors `core/queue/tasks.py`. Task handlers are
 * registered by key and invoked by `enqueue` through a JobProvider.
 */

export type TaskFunc = (payload: any) => Promise<unknown>;

const registry = new Map<string, TaskFunc>();

export function registerTask(taskKey: string, func: TaskFunc): void {
  if (registry.has(taskKey)) {
    throw new Error(`Task key '${taskKey}' is already registered`);
  }
  registry.set(taskKey, func);
}

/** Register a task only if its key is free (idempotent app-task wiring). */
export function registerTaskIfAbsent(taskKey: string, func: TaskFunc): void {
  if (!registry.has(taskKey)) registry.set(taskKey, func);
}

export function hasTask(taskKey: string): boolean {
  return registry.has(taskKey);
}

/** Decorator-style helper: `const send = task("send")(async (p) => {...})`. */
export function task(taskKey: string) {
  return (func: TaskFunc): TaskFunc => {
    registerTask(taskKey, func);
    return func;
  };
}

export async function executeRegisteredTask(taskKey: string, payload: unknown): Promise<unknown> {
  const target = registry.get(taskKey);
  if (!target) {
    const keys = listRegisteredTaskKeys().join(", ") || "<none>";
    throw new Error(`Task key '${taskKey}' is not registered. Available keys: ${keys}`);
  }
  return target(payload);
}

export function listRegisteredTaskKeys(): string[] {
  return [...registry.keys()].sort();
}

/** Test-only: reset the registry between cases. */
export function clearRegistry(): void {
  registry.clear();
}
