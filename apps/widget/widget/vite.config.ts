import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const distDir = resolve(__dirname, "../dist");

export default defineConfig(({ mode }) => {
  if (mode === "embed") {
    return {
      plugins: [react()],
      // Library-mode (IIFE) output isn't re-bundled by a consumer's own
      // build — it runs straight off a <script> tag in someone else's page,
      // where there's no `process` global. Without this, React's internal
      // process.env.NODE_ENV checks throw "process is not defined" at
      // runtime in the browser.
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
      },
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
