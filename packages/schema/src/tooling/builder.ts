/**
 * A small, dependency-free schema builder.
 *
 * One definition yields three things that must never drift apart:
 *   1. a static TypeScript type (via `Infer<typeof X>`),
 *   2. a runtime validator with JSON-pointer error paths,
 *   3. a JSON Schema (draft 2020-12) document for non-TypeScript consumers.
 *
 * Rules that JSON Schema cannot express (unique ids, sorted arrays, valid
 * calendar dates) are added with `refine`. They run only after the structural
 * check passes, and are listed in the emitted schema under
 * `x-glassrank-rules` so other implementations know to enforce them.
 */

export interface Issue {
  /** JSON pointer to the offending value, e.g. `/matches/0/teams/1`. */
  readonly path: string;
  readonly message: string;
}

export type JsonSchema = { readonly [key: string]: unknown };

export interface Schema<T> {
  readonly json: JsonSchema;
  readonly validate: (value: unknown, path: string, issues: Issue[]) => void;
  /** Phantom field carrying the static type. Never present at runtime. */
  readonly __type?: T;
}

export interface OptionalSchema<T> extends Schema<T> {
  readonly optional: true;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

type Simplify<T> = { [K in keyof T]: T[K] } & {};
type OptionalKeys<P> = {
  [K in keyof P]: P[K] extends OptionalSchema<unknown> ? K : never;
}[keyof P];
type RequiredKeys<P> = Exclude<keyof P, OptionalKeys<P>>;
export type ObjectOf<P extends Record<string, Schema<unknown>>> = Simplify<
  { readonly [K in RequiredKeys<P>]: Infer<P[K]> } & {
    readonly [K in OptionalKeys<P>]?: Infer<P[K]>;
  }
>;

function make<T>(json: JsonSchema, validate: Schema<T>["validate"]): Schema<T> {
  return { json, validate };
}

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Escape a key for use in a JSON pointer (RFC 6901). */
export function pointer(base: string, key: string | number): string {
  const token = String(key).replace(/~/g, "~0").replace(/\//g, "~1");
  return `${base}/${token}`;
}

interface Described {
  readonly description?: string;
}

function withDescription(json: JsonSchema, opts: Described | undefined): JsonSchema {
  return opts?.description === undefined ? json : { ...json, description: opts.description };
}

export interface StringOptions extends Described {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}

export function string(opts: StringOptions = {}): Schema<string> {
  const re = opts.pattern === undefined ? undefined : new RegExp(opts.pattern, "u");
  const json: Record<string, unknown> = { type: "string" };
  if (opts.minLength !== undefined) json["minLength"] = opts.minLength;
  if (opts.maxLength !== undefined) json["maxLength"] = opts.maxLength;
  if (opts.pattern !== undefined) json["pattern"] = opts.pattern;
  return make(withDescription(json, opts), (value, path, issues) => {
    if (typeof value !== "string") {
      issues.push({ path, message: `expected string, got ${typeName(value)}` });
      return;
    }
    // Length in code points, matching JSON Schema semantics.
    const length = [...value].length;
    if (opts.minLength !== undefined && length < opts.minLength) {
      issues.push({ path, message: `must have at least ${opts.minLength} characters` });
    }
    if (opts.maxLength !== undefined && length > opts.maxLength) {
      issues.push({ path, message: `must have at most ${opts.maxLength} characters` });
    }
    if (re !== undefined && !re.test(value)) {
      issues.push({ path, message: `must match pattern ${opts.pattern}` });
    }
  });
}

export interface NumberOptions extends Described {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
}

function numeric(kind: "number" | "integer", opts: NumberOptions): Schema<number> {
  const json: Record<string, unknown> = { type: kind };
  if (opts.minimum !== undefined) json["minimum"] = opts.minimum;
  if (opts.maximum !== undefined) json["maximum"] = opts.maximum;
  if (opts.exclusiveMinimum !== undefined) json["exclusiveMinimum"] = opts.exclusiveMinimum;
  if (opts.exclusiveMaximum !== undefined) json["exclusiveMaximum"] = opts.exclusiveMaximum;
  return make(withDescription(json, opts), (value, path, issues) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push({ path, message: `expected finite number, got ${typeName(value)}` });
      return;
    }
    if (kind === "integer" && !Number.isSafeInteger(value)) {
      issues.push({ path, message: "expected integer" });
      return;
    }
    if (opts.minimum !== undefined && value < opts.minimum) {
      issues.push({ path, message: `must be >= ${opts.minimum}` });
    }
    if (opts.maximum !== undefined && value > opts.maximum) {
      issues.push({ path, message: `must be <= ${opts.maximum}` });
    }
    if (opts.exclusiveMinimum !== undefined && value <= opts.exclusiveMinimum) {
      issues.push({ path, message: `must be > ${opts.exclusiveMinimum}` });
    }
    if (opts.exclusiveMaximum !== undefined && value >= opts.exclusiveMaximum) {
      issues.push({ path, message: `must be < ${opts.exclusiveMaximum}` });
    }
  });
}

export function number(opts: NumberOptions = {}): Schema<number> {
  return numeric("number", opts);
}

export function integer(opts: NumberOptions = {}): Schema<number> {
  return numeric("integer", opts);
}

export function boolean(opts: Described = {}): Schema<boolean> {
  return make(withDescription({ type: "boolean" }, opts), (value, path, issues) => {
    if (typeof value !== "boolean") {
      issues.push({ path, message: `expected boolean, got ${typeName(value)}` });
    }
  });
}

export function literal<const V extends string | number | boolean>(
  value: V,
  opts: Described = {},
): Schema<V> {
  return make(withDescription({ const: value }, opts), (actual, path, issues) => {
    if (actual !== value) {
      issues.push({ path, message: `expected ${JSON.stringify(value)}` });
    }
  });
}

export function enumOf<const V extends readonly [string, ...string[]]>(
  values: V,
  opts: Described = {},
): Schema<V[number]> {
  const allowed = new Set<string>(values);
  return make(
    withDescription({ type: "string", enum: [...values] }, opts),
    (value, path, issues) => {
      if (typeof value !== "string" || !allowed.has(value)) {
        issues.push({ path, message: `expected one of ${values.join(", ")}` });
      }
    },
  );
}

export interface ArrayOptions extends Described {
  readonly minItems?: number;
  readonly maxItems?: number;
}

export function array<T>(item: Schema<T>, opts: ArrayOptions = {}): Schema<readonly T[]> {
  const json: Record<string, unknown> = { type: "array", items: item.json };
  if (opts.minItems !== undefined) json["minItems"] = opts.minItems;
  if (opts.maxItems !== undefined) json["maxItems"] = opts.maxItems;
  return make(withDescription(json, opts), (value, path, issues) => {
    if (!Array.isArray(value)) {
      issues.push({ path, message: `expected array, got ${typeName(value)}` });
      return;
    }
    if (opts.minItems !== undefined && value.length < opts.minItems) {
      issues.push({ path, message: `must have at least ${opts.minItems} items` });
    }
    if (opts.maxItems !== undefined && value.length > opts.maxItems) {
      issues.push({ path, message: `must have at most ${opts.maxItems} items` });
    }
    value.forEach((v, i) => item.validate(v, pointer(path, i), issues));
  });
}

export function tuple<const S extends readonly Schema<unknown>[]>(
  items: S,
  opts: Described = {},
): Schema<{ readonly [K in keyof S]: Infer<S[K]> }> {
  const json = {
    type: "array",
    prefixItems: items.map((s) => s.json),
    items: false,
    minItems: items.length,
    maxItems: items.length,
  };
  return make(withDescription(json, opts), (value, path, issues) => {
    if (!Array.isArray(value)) {
      issues.push({ path, message: `expected array, got ${typeName(value)}` });
      return;
    }
    if (value.length !== items.length) {
      issues.push({ path, message: `must have exactly ${items.length} items` });
      return;
    }
    items.forEach((s, i) => s.validate(value[i], pointer(path, i), issues));
  });
}

export function optional<T>(schema: Schema<T>): OptionalSchema<T> {
  return { ...schema, optional: true };
}

export interface ObjectOptions extends Described {
  readonly title?: string;
}

export function object<P extends Record<string, Schema<unknown>>>(
  props: P,
  opts: ObjectOptions = {},
): Schema<ObjectOf<P>> {
  const keys = Object.keys(props).sort();
  const required = keys.filter((k) => !(props[k] as Partial<OptionalSchema<unknown>>).optional);
  const properties: Record<string, JsonSchema> = {};
  for (const k of keys) properties[k] = (props[k] as Schema<unknown>).json;
  const json: Record<string, unknown> = {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
  if (opts.title !== undefined) json["title"] = opts.title;
  const known = new Set(keys);
  return make(withDescription(json, opts), (value, path, issues) => {
    if (!isPlainObject(value)) {
      issues.push({ path, message: `expected object, got ${typeName(value)}` });
      return;
    }
    for (const k of Object.keys(value).sort()) {
      if (!known.has(k)) issues.push({ path: pointer(path, k), message: "unknown property" });
    }
    for (const k of keys) {
      const schema = props[k] as Schema<unknown> & Partial<OptionalSchema<unknown>>;
      if (!Object.hasOwn(value, k)) {
        if (!schema.optional) issues.push({ path: pointer(path, k), message: "required" });
        continue;
      }
      schema.validate(value[k], pointer(path, k), issues);
    }
  });
}

/** Map with string keys matching `keyPattern`. Keys are sorted in canonical form. */
export function record<T>(
  keyPattern: string,
  value: Schema<T>,
  opts: Described & { readonly maxProperties?: number } = {},
): Schema<{ readonly [key: string]: T }> {
  const re = new RegExp(keyPattern, "u");
  const json: Record<string, unknown> = {
    type: "object",
    propertyNames: { pattern: keyPattern },
    additionalProperties: value.json,
  };
  if (opts.maxProperties !== undefined) json["maxProperties"] = opts.maxProperties;
  return make(withDescription(json, opts), (v, path, issues) => {
    if (!isPlainObject(v)) {
      issues.push({ path, message: `expected object, got ${typeName(v)}` });
      return;
    }
    const entries = Object.keys(v).sort();
    if (opts.maxProperties !== undefined && entries.length > opts.maxProperties) {
      issues.push({ path, message: `must have at most ${opts.maxProperties} entries` });
    }
    for (const k of entries) {
      if (!re.test(k)) issues.push({ path: pointer(path, k), message: `key must match ${keyPattern}` });
      value.validate(v[k], pointer(path, k), issues);
    }
  });
}

export function nullable<T>(schema: Schema<T>): Schema<T | null> {
  return make({ anyOf: [schema.json, { type: "null" }] }, (value, path, issues) => {
    if (value !== null) schema.validate(value, path, issues);
  });
}

/**
 * Discriminated union: `tag` names the field whose string value selects the
 * variant. Errors come from the selected variant only, so they stay readable.
 */
export function tagged<const Tag extends string, V extends Record<string, Schema<unknown>>>(
  tag: Tag,
  variants: V,
  opts: Described = {},
): Schema<Infer<V[keyof V]>> {
  const names = Object.keys(variants).sort();
  const json = { oneOf: names.map((n) => (variants[n] as Schema<unknown>).json) };
  return make(withDescription(json, opts), (value, path, issues) => {
    if (!isPlainObject(value)) {
      issues.push({ path, message: `expected object, got ${typeName(value)}` });
      return;
    }
    const t = value[tag];
    if (typeof t !== "string" || !Object.hasOwn(variants, t)) {
      issues.push({ path: pointer(path, tag), message: `expected one of ${names.join(", ")}` });
      return;
    }
    (variants[t] as Schema<unknown>).validate(value, path, issues);
  });
}

/**
 * Add a semantic rule that JSON Schema cannot express. `rule` is a one-line
 * statement of it, published in the emitted schema.
 */
export function refine<T>(
  schema: Schema<T>,
  rule: string,
  check: (value: T, path: string, issues: Issue[]) => void,
): Schema<T> {
  // Apply `optional()` after `refine()`, never before.
  const prior = (schema.json["x-glassrank-rules"] as readonly string[] | undefined) ?? [];
  return make({ ...schema.json, "x-glassrank-rules": [...prior, rule] }, (value, path, issues) => {
    const before = issues.length;
    schema.validate(value, path, issues);
    if (issues.length === before) check(value as T, path, issues);
  });
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly Issue[] };

/** Validate untrusted data. On success the input is returned unchanged, now typed. */
export function parse<T>(schema: Schema<T>, value: unknown): ParseResult<T> {
  const issues: Issue[] = [];
  schema.validate(value, "", issues);
  return issues.length === 0 ? { ok: true, value: value as T } : { ok: false, issues };
}

export class SchemaError extends Error {
  readonly issues: readonly Issue[];
  constructor(issues: readonly Issue[]) {
    const first = issues.slice(0, 5).map((i) => `${i.path || "/"}: ${i.message}`);
    const more = issues.length > 5 ? ` (+${issues.length - 5} more)` : "";
    super(`invalid input: ${first.join("; ")}${more}`);
    this.name = "SchemaError";
    this.issues = issues;
  }
}

/** Like `parse`, but throws `SchemaError`. */
export function assertValid<T>(schema: Schema<T>, value: unknown): T {
  const result = parse(schema, value);
  if (!result.ok) throw new SchemaError(result.issues);
  return result.value;
}
