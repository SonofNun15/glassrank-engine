import * as s from "../tooling/builder";
import { HASH_PATTERN } from "../tooling/canonical";
import { TIMESTAMP_PATTERN, tryParseTimestamp } from "../tooling/time";

/**
 * Current schema version. Pre-1.0, a minor bump may change shapes; a patch
 * bump never does. Every top-level document carries `schemaVersion`.
 */
export const SCHEMA_VERSION = "0.1.0" as const;

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Same major; and while major is 0, same minor. Any patch is accepted. */
export function isCompatibleSchemaVersion(version: string): boolean {
  const theirs = SEMVER_RE.exec(version);
  const ours = SEMVER_RE.exec(SCHEMA_VERSION);
  if (theirs === null || ours === null) return false;
  if (theirs[1] !== ours[1]) return false;
  return ours[1] !== "0" || theirs[2] === ours[2];
}

export const SchemaVersion = s.refine(
  s.string({ pattern: "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$" }),
  `compatible with schema ${SCHEMA_VERSION} (same major; same minor while major is 0)`,
  (v, path, issues) => {
    if (!isCompatibleSchemaVersion(v)) {
      issues.push({ path, message: `schema version ${v} is not compatible with ${SCHEMA_VERSION}` });
    }
  },
);

const ID_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$";

function id(description: string): s.Schema<string> {
  return s.string({ pattern: ID_PATTERN, description });
}

/** Opaque identifiers. The engine never sees names, contact details, or age. */
export const PlayerId = id("Opaque player id assigned by the registry. Never a name or email.");
export const EventId = id("Opaque event id, unique within the ledger.");
export const MatchId = id("Match id, unique within its event.");
export const HostId = id("Opaque id of the club or organizer that vouched for the results.");
export const PolicyId = id("Policy config id, e.g. `glassrank-2026.1`.");
export const OverlayId = id("Correction overlay id.");

export const Timestamp = s.refine(
  s.string({
    pattern: TIMESTAMP_PATTERN,
    description: "RFC 3339 UTC instant with whole seconds, e.g. 2026-11-14T09:00:00Z.",
  }),
  "is a real calendar instant at or after 1970-01-01T00:00:00Z",
  (v, path, issues) => {
    if (tryParseTimestamp(v) === undefined) issues.push({ path, message: "not a valid instant" });
  },
);

export const Hash = s.string({
  pattern: HASH_PATTERN,
  description: "SHA-256 of the canonical JSON (RFC 8785) of the referenced value.",
});

export const Version = s.string({
  pattern: "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$",
  description: "Semantic version.",
});

/**
 * A rating on the published scale. The policy sets the live bounds (e.g. 2.0
 * to 8.0); this wider range only rejects obvious garbage at the seam.
 */
export const Rating = s.number({ minimum: 0, maximum: 10, description: "Rating on the published scale." });

/** Evidence-layer uncertainty, in rating units. */
export const Sigma = s.number({ exclusiveMinimum: 0, maximum: 10, description: "Standard deviation in rating units." });

/** Rating change, in rating units. */
export const RatingDelta = s.number({ minimum: -10, maximum: 10 });

export const Probability = s.number({ minimum: 0, maximum: 1 });

export const UnitWeight = s.number({ minimum: 0, maximum: 1 });

export const Discipline = s.enumOf(["singles", "doubles"], {
  description: "Rated separately. Derived from team size: 1 is singles, 2 is doubles.",
});

/** Named numeric parameters, e.g. evidence model settings. Keys are snake_case. */
export const NumberMap = s.record("^[a-z][a-z0-9_]{0,47}$", s.number(), { maxProperties: 64 });

export type PlayerId = s.Infer<typeof PlayerId>;
export type EventId = s.Infer<typeof EventId>;
export type MatchId = s.Infer<typeof MatchId>;
export type HostId = s.Infer<typeof HostId>;
export type PolicyId = s.Infer<typeof PolicyId>;
export type OverlayId = s.Infer<typeof OverlayId>;
export type Timestamp = s.Infer<typeof Timestamp>;
export type Discipline = s.Infer<typeof Discipline>;
export type NumberMap = s.Infer<typeof NumberMap>;
