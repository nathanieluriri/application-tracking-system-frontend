import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    hookTimeout: 120_000, // first mongodb-memory-server download can be slow
    testTimeout: 20_000,
    // Repository/integration suites each spin up their own in-memory Mongo and
    // mutate process.env. Run test files serially so they don't race on the
    // process-level connection singleton.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@server": resolve(__dirname, "./src/server"),
      "@": resolve(__dirname, "./src"),
    },
  },
});
