import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist-extension",
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: "extension/content.ts",
      name: "ResumeFitCheckerAssistedApply",
      formats: ["iife"],
      fileName: () => "content.js",
    },
  },
});
