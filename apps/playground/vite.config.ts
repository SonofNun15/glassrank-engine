import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg = (name: string) => fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/; set BASE_PATH there.
  base: process.env["BASE_PATH"] ?? "/",
  plugins: [
    react(),
    {
      // Static hosts serve 404.html for unknown paths; make it the app so deep links work.
      name: "spa-404",
      apply: "build",
      closeBundle() {
        const dist = fileURLToPath(new URL("./dist/", import.meta.url));
        copyFileSync(`${dist}index.html`, `${dist}404.html`);
      },
    },
  ],
  resolve: {
    // Build straight from workspace sources; no package build step needed.
    alias: {
      "@glassrank/schema": pkg("schema"),
      "@glassrank/engine": pkg("engine"),
      "@glassrank/sim": pkg("sim"),
      "@glassrank/design/tokens.css": fileURLToPath(new URL("../../packages/design/src/tokens.css", import.meta.url)),
      "@glassrank/design/components.css": fileURLToPath(new URL("../../packages/design/src/components.css", import.meta.url)),
      "@glassrank/design": fileURLToPath(new URL("../../packages/design/src/index.ts", import.meta.url)),
    },
  },
});
