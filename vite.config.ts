import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

/**
 * Vite configuration for Envault.
 *
 * Envault is a local-only application: the bundle must never reference remote
 * origins. Everything (fonts, icons, scripts) is bundled from node_modules.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Prevent Vite from obscuring Rust errors during `tauri dev`.
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    // Tauri targets a modern WebKit; no legacy transpilation needed.
    target: "es2022",
    sourcemap: false,
    // WebKit supports modulepreload natively. Dropping the polyfill removes
    // the only `fetch()` call that would otherwise ship in the bundle.
    modulePreload: { polyfill: false },
  },

  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
