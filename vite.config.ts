import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gamesApiOrigin =
    env.VITE_GAMES_API_ORIGIN ??
    env.VITE_QUEENS_API_ORIGIN ??
    "https://api.arturops.com";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/api/v1": {
          target: gamesApiOrigin,
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("vite/preload-helper")) {
              return "runtime";
            }
            if (id.includes("node_modules/pixi.js")) {
              return "pixi";
            }
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/scheduler/")
            ) {
              return "react";
            }
            if (id.includes("node_modules/lucide-react/")) {
              return "icons";
            }
          },
        },
      },
    },
  };
});
