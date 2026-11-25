# Integrating GlassRank

For a service (for example the hosted GlassRank API) that stores ratings and
calls the engine. Everything here can be done from the published packages and
schemas without reading engine source.

## Calling the engine

- **TypeScript or JavaScript:** `import { rate, replay, ... } from "@glassrank/engine"`.
- **Any other language:** run the `glassrank` command from `@glassrank/cli`
  with a JSON request on stdin; read the JSON response from stdout. It can run
  as a subprocess per call or behind a small sidecar.
- **Validate at your edge** with the JSON Schema files in
  `@glassrank/schema/json-schema/`. They cover structure; the extra rules each
  schema lists under `x-glassrank-rules` (unique ids, sorted priors, real
  dates) are enforced by the engine, which rejects violations with exit code 2.

## What the service stores

| Data | Notes |
| --- | --- |
| Event log | Every accepted `EventInput`, append-only, ordered by `(occurredAt, eventId)`. |
| Current rating state | The latest `RatingState` per (player, discipline), stored exactly as returned and passed back unchanged as the next prior. |
| Rate requests by hash | Every `RateRequest` sent to `rate`, keyed by its `inputHash`. Receipts carry that hash; `verify` needs the request. |
| Receipts | Every receipt, for player history and audits. |
| Policy schedule | The published `PolicySchedule`: every policy version and correction overlay with its dates. |
| Seeds | Each player's starting rating claim, with its source. |

## Rating an event

1. Resolve the policy in force at the event time (`resolvePolicy` in the
   engine, or the same rule: latest policy with `effectiveFrom <= occurredAt`,
   plus any overlay with `effectiveFrom <= occurredAt < expiresAt`).
2. Build the priors: for every (player, discipline) in the event, the stored
   `RatingState`, or a `Seed` for a first-time player. Sort by
   `(discipline, playerId)`. Include players from voided matches.
3. Call `rate`. Store the request by its `inputHash`, the returned states,
   and the receipts.

Rate events in log order. Two events for the same player must not be rated
concurrently, because each needs the other's result as its prior.

## Voids, corrections, and late results

Mark the match `trust.voided = true` (or lower `trust.weight`) in the stored
event and call `replay` from that event onward, with the players' states from
just before it as `initial`. Replace stored states and receipts with the
replay output. A late-arriving event is the same: insert it in order and
replay from there.

## Showing ratings

- `RatingState.rating` is the displayed rating; round it to the policy's
  `scale.displayDecimals`.
- While `RatingState.provisional` is not null, show the range
  (`low` to `high`) and "provisional" instead of a single number.
- `explainReceipt` (or the `explain` command) renders a receipt as a headline,
  a summary, and details. Receipts store facts, so the wording can change
  without changing any rating.
- `forecast` answers "what happens if I win 11-7?" before a match;
  `predict` gives win probabilities for balancing courts.

## Simulation recipes

Feedback can carry a `SimulationRecipe` as evidence. Validate it with
`SimulationRecipe` from `@glassrank/sim` (or its JSON Schema), store it with
its `recipeHash` and `createdWith` versions, and re-run it with
`simulateRecipe` (or `glassrank simulate`) to confirm what the submitter saw.
The format's size limits keep every accepted recipe quick to run.

## Checking a port

If the service reimplements the engine instead of calling it, run
`conformance/check.mjs` against the port. Every case must match byte for byte.
