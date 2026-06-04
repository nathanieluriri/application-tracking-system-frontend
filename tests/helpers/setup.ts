import { config } from "dotenv";

// Load test env before any @server module reads process.env.
config({ path: ".env.test" });
