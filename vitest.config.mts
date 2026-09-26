import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // "server-only" throws outside Next.js; tests run server code directly.
    alias: { "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts") },
  },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "tests/e2e"],
    // Database tests share one database: run files one at a time.
    fileParallelism: false,
  },
});
