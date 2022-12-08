import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import topLevelAwait from "vite-plugin-top-level-await";
import { ViteRsw } from "vite-plugin-rsw";

// https://vitejs.dev/config/
export default defineConfig({
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
