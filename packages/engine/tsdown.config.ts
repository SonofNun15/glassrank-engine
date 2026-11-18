import { defineConfig } from "tsdown";

// Bundles src/index.ts into dist/index.js plus a bundled dist/index.d.ts.
// "neutral" keeps Node-only APIs out, so the output runs in browsers too.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "neutral",
  dts: { sourcemap: true },
  sourcemap: true,
});
