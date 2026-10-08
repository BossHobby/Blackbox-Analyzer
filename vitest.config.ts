import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

// Kept apart from vite.config.ts so tests don't trigger the rsw wasm build.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
