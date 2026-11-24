/**
 * verify(): anyone can check a receipt. Given the stored request whose hash
 * the receipt carries, re-run it and compare, field by field.
 */
import {
  SCHEMA_VERSION,
  VerifyRequest,
  assertValid,
  canonicalJson,
  hashCanonical,
  type Receipt,
  type VerifyResponse,
} from "@glassrank/schema";
import { rateUnchecked } from "./rate";

const MAX_MISMATCHES = 100;

type Mismatch = { path: string; expected: string; actual: string };

/** Differences between two JSON values, as JSON pointers to canonical-JSON leaves. */
function diff(expected: unknown, actual: unknown, path: string, out: Mismatch[]): void {
  if (out.length >= MAX_MISMATCHES) return;
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
  if (isObj(expected) && isObj(actual) && Array.isArray(expected) === Array.isArray(actual)) {
    const keys = Array.isArray(expected)
      ? Array.from({ length: Math.max(expected.length, (actual as unknown as unknown[]).length) }, (_, i) => String(i))
      : [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const k of keys) {
      const token = k.replace(/~/g, "~0").replace(/\//g, "~1");
      diff((expected as Record<string, unknown>)[k], (actual as Record<string, unknown>)[k], `${path}/${token}`, out);
    }
    return;
  }
  const e = expected === undefined ? "(missing)" : canonicalJson(expected);
  const a = actual === undefined ? "(missing)" : canonicalJson(actual);
  if (e !== a) out.push({ path: path || "/", expected: e, actual: a });
}

export function verifyUnchecked(request: VerifyRequest): VerifyResponse {
  const { input, receipt } = request;
  const inputHashMatches = receipt.provenance.inputHash === hashCanonical(input);
  const recomputed = rateUnchecked(input).receipts.find(
    (r) => r.playerId === receipt.playerId && r.discipline === receipt.discipline,
  );
  const mismatches: Mismatch[] = [];
  if (recomputed === undefined) {
    mismatches.push({
      path: "/playerId",
      expected: "(a participant in the request)",
      actual: canonicalJson(receipt.playerId),
    });
  } else {
    diff(recomputed satisfies Receipt, receipt, "", mismatches);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    ok: inputHashMatches && mismatches.length === 0,
    inputHashMatches,
    mismatches,
  };
}

/** Re-run a receipt's request and report whether the receipt matches. Validates the request. */
export function verify(request: unknown): VerifyResponse {
  return verifyUnchecked(assertValid(VerifyRequest, request));
}
