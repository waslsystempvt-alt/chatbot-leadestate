import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const distDir = resolve(__dirname, "../dist");

export default defineConfig(({ mode }) => {
  if (mode === "embed") {
    return {
      plugins: [react()],
      build: {
        lib: {
          entry: resolve(__dirname, "src/embed.tsx"),
          name: "LeadEstateChat",
          formats: ["iife"],
          fileName: () => "chatbot.js",
        },
        outDir: distDir,
        emptyOutDir: false,
        cssFileName: "chatbot",
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
      },
    };
  }

  return {
    plugins: [react()],
    build: {
      outDir: distDir,
      emptyOutDir: true,
    },
  };
});
