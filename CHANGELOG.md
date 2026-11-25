# Changelog

## 0.1.0 (unreleased)

First release of the open packages: `@glassrank/schema`, `@glassrank/engine`,
and `@glassrank/cli`. Schema 0.1.0, engine 0.1.0.

- Data model for events, seeds, rating state, policy and correction
  overlays, receipts, and every entry point's request and response, with
  runtime validation and published JSON Schema.
- Engine: `rate`, `predict`, `forecast`, `replay`, `verify`, and
  `explainReceipt`. Evidence models `elo_baseline` and `bayes_v0`; community
  rules for provisional ratings, upward bias, decline damping, returning
  players, correction overlays, large-gain holds, a rolling decline cap, and
  scale bounds.
- `glassrank` command-line tool and conformance cases for checking other
  implementations.
- `@glassrank/sim`: simulated communities, metrics, policy tuning, and
  simulation recipes (reproducible, size-limited JSON describing a run,
  including custom players and up to four rating systems), with
  `simulateRecipe()` and `glassrank simulate`.
