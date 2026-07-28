import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gamesApiOrigin =
    env.VITE_GAMES_API_ORIGIN ??
    env.VITE_QUEENS_API_ORIGIN ??
    "https://api.arturops.com";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/queens": {
          target: gamesApiOrigin,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ""),
        },
        "/api/tango": {
          target: gamesApiOrigin,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ""),
        },
        "/api/lights": {
          target: gamesApiOrigin,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ""),
        },
        "/api/tracks": {
          target: gamesApiOrigin,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ""),
        },
        "/api/zip": {
          target: gamesApiOrigin,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
