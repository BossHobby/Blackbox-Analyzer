import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { viteStaticCopy } from "vite-plugin-static-copy";
import topLevelAwait from "vite-plugin-top-level-await";
import { ViteRsw } from "vite-plugin-rsw";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    ViteRsw(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/kissfft-wasm/lib/kissfft.wasm",
          dest: ".",
        },
        {
          src: "node_modules/kissfft-wasm/lib/kissfft.wasm",
          dest: "src/worker",
        },
        {
          src: "node_modules/kissfft-wasm/lib/kissfft.wasm",
          dest: "assets",
        },
      ],
    }),
    topLevelAwait(),
    vue(),
    vueJsx(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  worker: {
    format: "es",
  },
});
