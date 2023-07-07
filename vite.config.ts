import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import topLevelAwait from "vite-plugin-top-level-await";
import { ViteRsw } from "vite-plugin-rsw";

const base = "/";

// https://vitejs.dev/config/
export default defineConfig({
  base: base,
  plugins: [ViteRsw(), topLevelAwait(), vue(), vueJsx()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  worker: {
    format: "es",
  },
});
