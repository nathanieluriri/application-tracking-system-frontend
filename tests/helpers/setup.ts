import { config } from "dotenv";
import { registerAllTasks } from "@server/core/queue/tasks";

// Load test env before any @server module reads process.env.
config({ path: ".env.test" });

// Register background tasks so `enqueue(...)` is a no-op rather than an
// "unregistered task" error during tests.
registerAllTasks();
