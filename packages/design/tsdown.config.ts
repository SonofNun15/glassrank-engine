import { defineConfig } from "tsdown";

// React components to dist/; the CSS files ship as-is from src/.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "browser",
  dts: { sourcemap: true },
  sourcemap: true,
  external: ["react", "react/jsx-runtime"],
});
