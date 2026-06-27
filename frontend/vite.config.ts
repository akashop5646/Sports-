import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 8080,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/auth/me": { target: "http://localhost:5000", changeOrigin: true },
      "/auth/logout": { target: "http://localhost:5000", changeOrigin: true },
      "/auth/dev-login": { target: "http://localhost:5000", changeOrigin: true },
      "/auth/google-url": { target: "http://localhost:5000", changeOrigin: true },
      "/auth/google-callback": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
});
