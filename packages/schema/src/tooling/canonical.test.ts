import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CanonicalizationError, canonicalJson, hashCanonical } from "./canonical";

describe("hashCanonical", () => {
  const nodeHash = (value: unknown) =>
    `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;

  it("is SHA-256 of the canonical JSON's UTF-8 bytes", () => {
    expect(hashCanonical("abc")).toBe(nodeHash("abc"));
    for (const value of [
      null,
      { b: [1, 2.5, -0], a: "é 日本語 🏓" },
      { long: "a".repeat(1000), lone: "\ud83c" },
      [true, false, { z: { y: { x: 1 } } }],
    ]) {
      expect(hashCanonical(value)).toBe(nodeHash(value));
    }
  });
});

describe("canonicalJson", () => {
  it("sorts keys at every depth and drops whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}',
    );
  });

  it("writes numbers per RFC 8785", () => {
    expect(canonicalJson([0, -0, 1, 0.1, 1e21, 1e-7, 3.42, 100, -2.5])).toBe(
      "[0,0,1,0.1,1e+21,1e-7,3.42,100,-2.5]",
    );
  });

  it("sorts keys by UTF-16 code units", () => {
    expect(canonicalJson({ "é": 1, z: 2, "🏓": 3, A: 4 })).toBe(
      '{"A":4,"z":2,"é":1,"🏓":3}',
    );
  });

  it("rejects values JSON cannot represent", () => {
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(CanonicalizationError);
    expect(() => canonicalJson({ a: Number.POSITIVE_INFINITY })).toThrow(CanonicalizationError);
    expect(() => canonicalJson({ a: undefined })).toThrow(/\/a: undefined value/);
    expect(() => canonicalJson({ when: new Date(0) })).toThrow(/plain objects/);
    expect(() => canonicalJson(() => 1)).toThrow(CanonicalizationError);
  });

  it("hashes equal values equally regardless of key order", () => {
    const a = hashCanonical({ x: 1, y: [1, 2], z: { b: true, a: "s" } });
    const b = hashCanonical({ z: { a: "s", b: true }, y: [1, 2], x: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(hashCanonical({ y: [2, 1] })).not.toBe(hashCanonical({ y: [1, 2] }));
  });
});
