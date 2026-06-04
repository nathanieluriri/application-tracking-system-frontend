import { config } from "dotenv";
import { registerAllTasks } from "@server/core/queue/tasks";
import { QueueManager } from "@server/core/queue/manager";
import { InlineJobProvider } from "@server/core/queue/provider";

// Load test env before any @server module reads process.env.
config({ path: ".env.test" });

// Register background tasks so `enqueue(...)` is a no-op rather than an
// "unregistered task" error during tests.
registerAllTasks();

// Run enqueued tasks synchronously in tests so their effects are observable
// (e.g. outbound-email batch sends complete before assertions run).
QueueManager.configure(new InlineJobProvider(true));
