import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Tests truncate tables. They must never be able to reach a real database:
    // an empty DATABASE_URL forces lib/db onto PGlite, in memory, per worker.
    env: { DATABASE_URL: "", PGLITE_DIR: "memory://" },
    // PGlite boots a WASM Postgres per worker; give it room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: "forks",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
