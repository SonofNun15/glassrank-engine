/**
 * Canonical JSON and content hashing.
 *
 * Canonical form follows RFC 8785 (JSON Canonicalization Scheme): object keys
 * sorted by UTF-16 code units, no whitespace, and numbers written the way
 * ECMAScript's Number-to-String does (shortest round-trip form). That
 * algorithm is fully specified, so every conforming runtime emits the same
 * bytes. Values JSON cannot represent (undefined, NaN, Infinity, functions,
 * class instances) are rejected rather than silently dropped.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export class CanonicalizationError extends Error {
  constructor(path: string, message: string) {
    super(`${path || "/"}: ${message}`);
    this.name = "CanonicalizationError";
  }
}

function write(value: unknown, path: string, out: string[]): void {
  if (value === null) {
    out.push("null");
    return;
  }
  switch (typeof value) {
    case "boolean":
      out.push(value ? "true" : "false");
      return;
    case "number":
      if (!Number.isFinite(value)) throw new CanonicalizationError(path, "non-finite number");
      // JSON.stringify(-0) is "0", as RFC 8785 requires.
      out.push(JSON.stringify(value));
      return;
    case "string":
      out.push(JSON.stringify(value));
      return;
    case "object":
      break;
    default:
      throw new CanonicalizationError(path, `cannot encode ${typeof value}`);
  }
  if (Array.isArray(value)) {
    out.push("[");
    value.forEach((item, i) => {
      if (i > 0) out.push(",");
      write(item, `${path}/${i}`, out);
    });
    out.push("]");
    return;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null) {
    throw new CanonicalizationError(path, "only plain objects can be encoded");
  }
  const obj = value as Record<string, unknown>;
  // Default sort compares UTF-16 code units, matching RFC 8785.
  const keys = Object.keys(obj).sort();
  out.push("{");
  keys.forEach((k, i) => {
    const v = obj[k];
    if (v === undefined) throw new CanonicalizationError(`${path}/${k}`, "undefined value");
    if (i > 0) out.push(",");
    out.push(JSON.stringify(k), ":");
    write(v, `${path}/${k}`, out);
  });
  out.push("}");
}

export function canonicalJson(value: unknown): string {
  const out: string[] = [];
  write(value, "", out);
  return out.join("");
}

export const HASH_PATTERN = "^sha256:[0-9a-f]{64}$";

/** Content hash of the canonical form, spelled `sha256:<64 hex chars>`. */
export function hashCanonical(value: unknown): string {
  return `sha256:${bytesToHex(sha256(utf8ToBytes(canonicalJson(value))))}`;
}
