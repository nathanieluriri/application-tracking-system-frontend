/**
 * Next.js instrumentation — runs once when the server process boots.
 * Registers background tasks (so `enqueue(...)` resolves to real handlers) and
 * periodically warms the dashboard cache. Replaces the FastAPI lifespan +
 * APScheduler jobs. Node runtime only (skipped on the Edge runtime).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { registerAllTasks } = await import("@server/core/queue/tasks");
  registerAllTasks();

  // Periodic dashboard cache warm (replaces the APScheduler interval job).
  const { warmDashboardCache } = await import("@server/services/dashboard");
  const warm = () => {
    void warmDashboardCache().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[instrumentation] dashboard warm failed:", err);
    });
  };
  warm();
  const timer = setInterval(warm, 60_000);
  // Don't keep the event loop alive solely for the warm timer.
  if (typeof timer.unref === "function") timer.unref();
}
