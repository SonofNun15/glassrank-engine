import { describe, expect, expectTypeOf, it } from "vitest";
import * as s from "./builder";

const Player = s.object({
  id: s.string({ pattern: "^p-" }),
  rating: s.number({ minimum: 2, maximum: 8 }),
  nickname: s.optional(s.string({ maxLength: 3 })),
  hand: s.enumOf(["left", "right"]),
  pair: s.tuple([s.integer(), s.boolean()]),
});

const Shape = s.tagged("kind", {
  circle: s.object({ kind: s.literal("circle"), r: s.number() }),
  square: s.object({ kind: s.literal("square"), side: s.number() }),
});

function issuesOf<T>(schema: s.Schema<T>, value: unknown): s.Issue[] {
  const r = s.parse(schema, value);
  return r.ok ? [] : [...r.issues];
}

describe("schema builder", () => {
  it("infers readonly static types with optional keys", () => {
    type P = s.Infer<typeof Player>;
    expectTypeOf<P>().toEqualTypeOf<{
      readonly id: string;
      readonly rating: number;
      readonly nickname?: string;
      readonly hand: "left" | "right";
      readonly pair: readonly [number, boolean];
    }>();
    expectTypeOf<s.Infer<typeof Shape>>().toEqualTypeOf<
      { readonly kind: "circle"; readonly r: number } | { readonly kind: "square"; readonly side: number }
    >();
  });

  it("accepts valid values and returns them unchanged", () => {
    const value = { id: "p-1", rating: 3.5, hand: "left", pair: [1, true] };
    const r = s.parse(Player, value);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(value);
  });

  it("reports every problem with a JSON pointer", () => {
    const issues = issuesOf(Player, {
      id: "x-1",
      rating: 9,
      nickname: "toolong",
      hand: "both",
      pair: [1.5, true],
      age: 40,
    });
    expect(issues).toEqual([
      { path: "/age", message: "unknown property" },
      { path: "/hand", message: "expected one of left, right" },
      { path: "/id", message: "must match pattern ^p-" },
      { path: "/nickname", message: "must have at most 3 characters" },
      { path: "/pair/0", message: "expected integer" },
      { path: "/rating", message: "must be <= 8" },
    ]);
  });

  it("reports missing required keys but not missing optional ones", () => {
    expect(issuesOf(Player, { id: "p-1", hand: "left", pair: [1, false] })).toEqual([
      { path: "/rating", message: "required" },
    ]);
  });

  it("rejects explicit undefined, NaN, and non-plain values", () => {
    expect(issuesOf(Player, { id: "p-1", rating: Number.NaN, hand: "left", pair: [1, true], nickname: undefined }))
      .toEqual([
        { path: "/nickname", message: "expected string, got undefined" },
        { path: "/rating", message: "expected finite number, got number" },
      ]);
    expect(issuesOf(Player, null)).toEqual([{ path: "", message: "expected object, got null" }]);
    expect(issuesOf(Player, [])).toEqual([{ path: "", message: "expected object, got array" }]);
  });

  it("routes tagged unions by discriminator", () => {
    expect(issuesOf(Shape, { kind: "square", side: "4" })).toEqual([
      { path: "/side", message: "expected finite number, got string" },
    ]);
    expect(issuesOf(Shape, { kind: "hexagon" })).toEqual([
      { path: "/kind", message: "expected one of circle, square" },
    ]);
  });

  it("runs refinements only after the structure is valid", () => {
    let calls = 0;
    const Even = s.refine(s.integer(), "is even", (n, path, issues) => {
      calls++;
      if (n % 2 !== 0) issues.push({ path, message: "must be even" });
    });
    expect(issuesOf(Even, "2")).toHaveLength(1);
    expect(calls).toBe(0);
    expect(issuesOf(Even, 3)).toEqual([{ path: "", message: "must be even" }]);
    expect(Even.json["x-glassrank-rules"]).toEqual(["is even"]);
  });

  it("escapes JSON pointer tokens", () => {
    const M = s.record("^.*$", s.integer());
    expect(issuesOf(M, { "a/b~c": "x" })).toEqual([
      { path: "/a~1b~0c", message: "expected finite number, got string" },
    ]);
  });

  it("emits strict JSON Schema", () => {
    expect(Player.json).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["hand", "id", "pair", "rating"],
    });
    expect((Player.json["properties"] as Record<string, unknown>)["pair"]).toEqual({
      type: "array",
      prefixItems: [{ type: "integer" }, { type: "boolean" }],
      items: false,
      minItems: 2,
      maxItems: 2,
    });
  });

  it("assertValid throws a SchemaError listing issues", () => {
    expect(() => s.assertValid(Player, {})).toThrow(s.SchemaError);
    expect(() => s.assertValid(Player, {})).toThrow(/\/hand: required/);
  });
});
