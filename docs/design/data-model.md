# Data model v0.1: decisions

Status: milestone 1 draft (Nov 2026). Source of truth is `packages/schema/src`;
the published JSON Schema files in `packages/schema/json-schema/` are generated
from it by `pnpm generate`, and `pnpm test` fails if they drift. Fixtures in
`packages/schema/fixtures/` are validated by both the TypeScript validator and
the published JSON Schema (via Ajv); see the README there for which fixtures
are hand-written and which are generated.

## How schemas are defined

The data models live in `src/models/`. The helpers they are built with live
in `src/tooling/`: the schema builder, the list of published JSON Schema
documents, canonical JSON and hashing, and timestamps. Runtime dependencies are
`date-fns`, `@date-fns/utc`, and `@noble/hashes`.

The schema builder (`tooling/builder.ts`, hand-written, about 300 lines) turns
each definition into three things that cannot drift apart: a static
TypeScript type, a runtime validator with JSON-pointer error paths, and a JSON
Schema (draft 2020-12) document. Rules JSON Schema cannot express (unique ids,
sorted arrays, real calendar dates) are added with `refine` and listed in the
emitted schema under `x-glassrank-rules`, so ports in other languages know to
enforce them.

Objects reject unknown properties. Validation never copies, coerces, or fills
defaults: the bytes that were validated are the bytes that get hashed.

## Seam documents

| Document | Direction | Purpose |
| --- | --- | --- |
| `EventInput` | in | One event: source tier, matches, game scores, trust effects |
| `Seed` | in | Starting point for a first-time player (`self`, `host`, `external_claimed`, `policy_default`) |
| `RatingState` | in and out | Engine-owned state per player per discipline; callers store and return it unchanged |
| `Prior` | in | `{kind: "state"}` or `{kind: "seed"}` for each participant |
| `PolicyConfig` | in | Every tunable number |
| `CorrectionOverlay` | in | A temporary correction-dial setting with announce, start, and expiry times |
| `PolicySchedule` | in | Published history of policies and overlays, used by replay |
| `EffectivePolicy` | in | Base config plus at most one active overlay, for one event |
| `Receipt` | out | Three-tier explanation of one player's change from one event |
| `Rate/Predict/Forecast/Replay/Verify` `Request` and `Response` | in/out | Envelopes for each entry point, also the command-line format |

## Decisions

- **Timestamps** are RFC 3339 UTC with whole seconds (`2026-11-14T14:00:00Z`).
  There is one spelling per instant, so hashes are stable. Date math uses
  date-fns on `UTCDate` values (`@date-fns/utc`), so results never depend on
  the host time zone. A strict pattern plus an exact round trip rejects
  spellings date-fns would otherwise accept, such as hour 24. Tests run with
  `TZ=America/New_York` so any accidental local-time math fails.
- **Canonical JSON** follows RFC 8785. Hashes are `sha256:<hex>` over that
  form, computed with `@noble/hashes` (synchronous, audited, runs in Node and
  browsers alike).
- **Ordering is part of the input.** Priors must be sorted by
  `(discipline, playerId)`. Replay events must be sorted by `(occurredAt,
  eventId)`. Validation rejects anything else, rather than sorting silently.
- **Open play is not rated.** `EventFormat` has no `open_play` value. Hosts can
  still run open play in the app; those results never become an `EventInput`.
- **Player-reported results are not accepted.** `SourceTier` is
  `verified_host`, `provisional_host`, or `video_verified`; a host or video must
  vouch for every rated event. Player confirmation can still matter inside the
  app, but it never becomes a source tier.
- **Disciplines** (`singles`, `doubles`) are rated separately. A match's
  discipline comes from its team size; a 1-v-2 match is rejected.
- **Trust is an input, not a computation.** Each match carries
  `trust: {weight, voided, reason?}`. The policy maps the event's source tier
  to a weight (`sourceWeights`), so that mapping is public. Voided matches stay
  in the input and are counted in the receipt.
- **Every participant needs an explicit prior** in `RateRequest`, including
  players in voided matches. Priors for non-participants are rejected. Replay
  is the exception: players without an initial prior start from a
  `policy_default` seed.
- **Two layers in the state.** `RatingState.rating` is the displayed rating.
  `evidence {mu, sigma}` is what results alone say. Policy bookkeeping is in
  explicit fields (`heldGain`, `recentDeclines`) rather than an untyped bag.
- **Decline cap uses a rolling window** (`declineCap.windowDays`), so there is
  no time zone question. A calendar-month cap remains an open question.
- **Overlays can adjust only** `lossMultiplier`, `largeGainThreshold`, and
  `defaultRating`. The decline cap and returning-player protection are not
  adjustable by an overlay, and the schema enforces this.
- **Receipts are structured.** The headline is reason codes plus numeric facts;
  the sentence is rendered from them later, so wording can change without
  changing the hash. `technical.rules` lists every rule evaluated, in order,
  including ones that did not fire.
- **Reproducibility:** a receipt holds `inputHash`, the hash of the full
  `RateRequest`. The service stores that request once per event, and
  `verify(request, receipt)` re-runs it. Embedding the request in every
  receipt would repeat it once per player.
- **Privacy by construction:** ids are opaque (`^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$`,
  so an email address is rejected). There is no field for name, contact, or
  age anywhere, and unknown properties are rejected.
- **Evidence models** are a tagged union on `model`: `elo_baseline` (the
  metrics baseline) and `bayes_v0`. New models are added as new variants.
  Schema 0.1.0 is unreleased, so these additions did not bump the version.

## Versioning

`SCHEMA_VERSION` is `0.1.0`. While the major version is 0, data must match the
same minor version; any patch is accepted. A patch never changes shapes.

## Open questions this draft leaves open

- Calendar-month vs. rolling decline cap (draft uses rolling).
- Exemption rules for corrections beyond "away at least N days".
- The large-gain rule's exact semantics (draft: gain above `perEventThreshold`
  is held unless the event had `minGamesToExceed` games).
- Whether `EventFormat` or game `ending` (`timed`, `retired`) should affect the
  math. In v0.1 they are informational.
- Sim scenario and report formats are defined with the simulator (M2, M3),
  since they do not cross the engine seam.
