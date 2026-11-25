import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string) => fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests run against source, so no build is needed first.
    alias: {
      "@glassrank/schema": src("schema"),
      "@glassrank/engine": src("engine"),
      "@glassrank/sim": src("sim"),
      "@glassrank/cli": src("cli"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
    // A zone with daylight saving, so any accidental local-time math fails loudly.
    env: { TZ: "America/New_York" },
  },
});
