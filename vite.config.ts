import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [] } },
  server: { port: 5173 },
  preview: { port: 4174 },
  build: { sourcemap: true },
});
