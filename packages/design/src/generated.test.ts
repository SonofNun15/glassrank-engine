/**
 * tokens.css is generated from tokens.json (a copy of the GlassRank design
 * system's tokens). Change tokens.json, then run `pnpm generate`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { type Tokens, tokensToCss } from "./tokens-css";

const tokens: Tokens = JSON.parse(readFileSync(join(import.meta.dirname, "..", "tokens.json"), "utf8"));

it("tokens.css matches tokens.json", async () => {
  await expect(tokensToCss(tokens)).toMatchFileSnapshot(join(import.meta.dirname, "tokens.css"));
});

it("every color has a value in both themes and no alias points nowhere", () => {
  const names = new Set(tokens.color.tokens.map((t) => t.name));
  for (const t of tokens.color.tokens) {
    const values = typeof t.value === "string" ? [t.value] : Object.values(t.value);
    for (const v of values) {
      const alias = /^\{(.+)\}$/.exec(v);
      if (alias) expect(names.has(alias[1]!), `${t.name} -> ${alias[1]}`).toBe(true);
      else expect(v).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  }
});
