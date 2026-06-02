import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// GitHub Pages: set VITE_BASE_PATH to "/<repo-name>/" via env or workflow.
// For custom domain or root deploy, leave it as "/".
const BASE = process.env.VITE_BASE_PATH || "/";

// https://vitejs.dev/config/
export default defineConfig({
  base: BASE,
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
