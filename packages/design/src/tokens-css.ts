/**
 * Turns the design system's tokens.json into CSS custom properties.
 *
 * Light values sit on :root; dark values apply under the OS dark setting
 * (unless the page forces light) and whenever data-theme="dark" is set, so an
 * explicit choice wins both ways. Type styles become `.t-<name>` classes.
 */

interface ColorToken {
  readonly name: string;
  readonly value: string | Readonly<Record<string, string>>;
}
interface PlainToken {
  readonly name: string;
  readonly value: string | number | Readonly<Record<string, string>>;
}
interface TypeStyle {
  readonly name: string;
  readonly fontSize: string;
  readonly lineHeight?: string | number;
  readonly fontWeight?: number | string;
  readonly letterSpacing?: string;
  readonly family?: string;
}
export interface Tokens {
  readonly name: string;
  readonly color: { readonly themes: readonly { id: string }[]; readonly tokens: readonly ColorToken[] };
  readonly type: {
    readonly families: Readonly<Record<string, string>>;
    readonly groups: readonly { readonly family: string; readonly styles: readonly TypeStyle[] }[];
  };
  readonly spacing: { readonly tokens: readonly PlainToken[] };
  readonly radius: { readonly tokens: readonly PlainToken[] };
  readonly shadow?: { readonly tokens: readonly PlainToken[] };
}

const valueFor = (v: ColorToken["value"] | PlainToken["value"], theme: string, first: string): string => {
  if (typeof v === "string") return v;
  if (typeof v === "number") return `${v}px`;
  return v[theme] ?? v[first] ?? "";
};

/** `{other}` aliases become `var(--other)`. */
const css = (value: string) => value.replace(/^\{([A-Za-z0-9_.-]+)\}$/, "var(--$1)");

export function tokensToCss(t: Tokens): string {
  const themes = t.color.themes.map((th) => th.id);
  const first = themes[0] ?? "light";
  const dark = themes.find((id) => id === "dark");
  const lines: string[] = [`/* ${t.name} — generated from tokens.json */`, ""];

  const themed = (theme: string) => [
    ...t.color.tokens.map((c) => `  --${c.name}: ${css(valueFor(c.value, theme, first))};`),
    ...(t.shadow?.tokens ?? []).map((s) => `  --${s.name}: ${valueFor(s.value, theme, first)};`),
  ];

  lines.push(":root {", "  color-scheme: light;", ...themed(first));
  for (const [key, stack] of Object.entries(t.type.families)) lines.push(`  --font-${key}: ${stack};`);
  for (const s of [...t.spacing.tokens, ...t.radius.tokens]) lines.push(`  --${s.name}: ${valueFor(s.value, first, first)};`);
  lines.push("}", "");

  if (dark !== undefined) {
    const body = ["    color-scheme: dark;", ...themed(dark).map((l) => `  ${l}`)];
    lines.push("@media (prefers-color-scheme: dark) {", '  :root:not([data-theme="light"]) {', ...body, "  }", "}", "");
    lines.push(':root[data-theme="dark"] {', "  color-scheme: dark;", ...themed(dark), "}", "");
  }

  for (const group of t.type.groups) {
    for (const s of group.styles) {
      const props = [
        `font-family: var(--font-${s.family ?? group.family});`,
        `font-size: ${s.fontSize};`,
        s.lineHeight === undefined ? null : `line-height: ${s.lineHeight};`,
        s.fontWeight === undefined ? null : `font-weight: ${s.fontWeight};`,
        s.letterSpacing === undefined ? null : `letter-spacing: ${s.letterSpacing};`,
      ].filter((p) => p !== null);
      lines.push(`.t-${s.name} { ${props.join(" ")} }`);
    }
  }
  return `${lines.join("\n")}\n`;
}
