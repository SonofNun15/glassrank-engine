import { defineConfig } from "tsdown";

// dist/index.js exports runCommand (no I/O); dist/main.js is the `glassrank` executable.
export default defineConfig({
  entry: ["src/index.ts", "src/main.ts"],
  format: "esm",
  platform: "node",
  fixedExtension: false,
  dts: { sourcemap: true },
  sourcemap: true,
});
