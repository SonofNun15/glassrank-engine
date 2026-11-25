# Milestones

From skeleton to an engine the hosted service can adopt. Metrics come before
the engine, so there is a baseline to beat from the first engine commit.

| | Milestone | Package | Done when |
| --- | --- | --- | --- |
| M0 | Repository skeleton | all | Done. |
| M1 | Schemas and data contracts | schema | Done. Every seam object validates, canonicalizes, and hashes; JSON Schema is generated and checked with Ajv. See `data-model.md`. |
| M2 | Synthetic world | sim | Done. The same seed produces a byte-identical event log of schema-valid events. See `sim-world.md`. |
| M3 | Metrics harness and baseline | sim | Done. `pnpm sim` compares Elo, evidence only, GlassRank, and GlassRank with the dial. See `sim-results-v0.md`. |
| M4 | Evidence layer | engine | Done on one platform: `bayes_v0` beats Elo on calibration; golden vectors in `packages/engine/golden/`. Second-platform check pending (needs CI). |
| M5 | Policy layer and correction dial | engine | Done, with caveats: improver lag and decliner bias improve slightly vs. evidence only; the dial moves drift, but the sim shows deflation, not inflation. See `engine-impl-v0.1.md`. |
| M6 | Receipts, forecast, replay, verify | engine | Done. Every receipt from a simulated year verifies and renders to text; forecast agrees exactly with rate for the outcome that happened. |
| M7 | Tuning and published results | sim | Results and sample receipts are ready to show founding clubs and advisors. |
| M8 | Integration release | all | Done (not yet published to npm): `glassrank` CLI, conformance cases with a checker, 0.1.0 package metadata, `docs/integration.md`, `docs/compatibility.md`, `CHANGELOG.md`. |

## Scope notes

- **M2:** players with hidden true skill by cohort (fast improvers, steady,
  slow decliners, new, returners, an isolated older pool with bridge players);
  clubs running weekly doubles round robins with rotating partners; verified
  and provisional hosts plus one that inflates results; seeded RNG.
- **M3:** log loss and Brier score, tracking error per cohort, improver lag,
  convergence from bad seeds, scale drift over years, damage from the
  inflating host.
- **M4:** Bayesian doubles update (OpenSkill or Glicko style), score-margin
  model, uncertainty widening after time away, deterministic math.
- **M5:** upward bias, damped declines, decline cap, large-gain threshold,
  policy schedule resolution, overlays with expiry and exemptions.
- **M6:** three-tier receipts with a pure text renderer, forecast through the
  same path as rate, replay for voids and corrections.
- **M8:** JSON command line, conformance vectors, npm 0.1 packages, a
  compatibility policy for schema and policy versions.

## Later: ideas to explore

- **Community drift** (`community-drift.md`): detect when a local community's
  ratings drift apart from others and speed up the flow of rating points
  through play between and within them. Starts with a "shark pool" simulator
  experiment.
