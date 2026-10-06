import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { ViteRsw } from "vite-plugin-rsw";

const base = "/";

// https://vitejs.dev/config/
export default defineConfig({
  base: base,
  plugins: [ViteRsw(), vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@cargo/analysis": fileURLToPath(
        new URL("./@cargo/analysis/pkg", import.meta.url),
      ),
    },
  },
  worker: {
    format: "es",
  },
});
