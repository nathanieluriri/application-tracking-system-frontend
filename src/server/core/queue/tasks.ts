import { registerTaskIfAbsent } from "./registry";

/**
 * Central, idempotent registration of the app's background tasks. Called from
 * `instrumentation.ts` at boot and from the test setup. Individual modules
 * replace these no-ops with real implementations by registering earlier, or by
 * importing their own task module which calls `registerTaskIfAbsent` first.
 *
 * Keys mirror the FastAPI task keys enqueued across the services.
 */
export function registerAllTasks(): void {
  registerTaskIfAbsent("dashboard_refresh", async () => {
    // Real implementation lives in the dashboard module (cache warm).
  });
  registerTaskIfAbsent("close_position_cascade", async () => {
    // Closing a position has no cascade side effects yet.
  });
  registerTaskIfAbsent("send_application_acknowledgement", async () => {
    // Real implementation registered by the email/applications module.
  });
  registerTaskIfAbsent("send_status_change_email", async () => {
    // Real implementation registered by the email/applications module.
  });
  registerTaskIfAbsent("delete_tokens", async () => {
    // Real implementation registered by the auth module if needed.
  });
}
