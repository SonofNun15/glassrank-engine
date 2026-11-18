# Engine v0 and simulation: design notes

Status: working design. Captured from the founding design discussions (Nov 2026).

## Goals the math must serve

1. Transparency: players see how and why a rating changed, and can forecast.
2. Built for improvement: fast improvers should not get stuck below their skill.
3. Gentle with declines: drops are slow and mainly correct inaccurate ratings;
   returning and aging players are not punished quickly.
4. Scale stays meaningful over years (see "correction dial").

## Model shape

- Rated per **event** (round robin, ladder night, tournament), not per game.
  Pre-event ratings are frozen; the whole event is evaluated together so one fluke
  game does not swing a rating but a consistent pattern does.
- **Evidence layer**: Bayesian skill estimate with uncertainty (OpenSkill-style,
  supports doubles teams natively; Glicko-style is an alternative). Uses game
  score margins, not just win/loss. Output: what the data says.
- **Policy layer**: community rules applied on top of the evidence:
  - upward bias (gains apply readily),
  - damped declines,
  - monthly cap on total decline,
  - no inactivity decay; instead uncertainty widens after time away, so early
    results back move a player up quickly and down only modestly,
  - evidence threshold for large gains.
- **Correction dial**: a published, versioned policy config that can temporarily
  reduce loss damping (results count closer to face value) to counter scale
  inflation. Corrections are small, announced, evidence-based, and expire unless
  renewed. Protections for returning players and the monthly drop cap stay on.
- **Scale**: 2.0 to 8.0 style. New-player starting rating is a tunable parameter.

## Inputs that affect weighting

- **Submission source**: each result records who vouched for it, e.g. verified
  host, provisional host (new, lower weight), and later video-verified. Results
  from players alone are not a primary source. Weight is an engine input and is
  shown in the receipt.
- **Voided/down-weighted matches**: trust decisions are made outside the engine
  (anomaly detection is not open), but their effect is an explicit input
  (`weight`, `voided`) recorded in the receipt.
- **Seeds**: initial rating with a source tag (`self`, `host`, `external_claimed`)
  and wide uncertainty so bad seeds wash out in a few events.
- Age is never an input to rating math.

## Receipts (explanations), three tiers

1. Headline: "+0.06. You beat two higher-rated teams at Saturday's round robin."
2. Event summary: expected vs. actual, games that mattered most, protections applied.
3. Technical: per-game math, parameters, policy version, reproducible input.

## Voiding

Current leaning: voiding a match recomputes its event and replays later events
for affected players. The engine should make replay cheap (pure functions over
an ordered event log).

## Milestone 1: simulation

1. Synthetic world (`sim`): players with hidden true skill over time. Cohorts:
   fast improvers, steady, slow decliners, new players, returners after a layoff,
   and an isolated older pool with a few bridge players. Clubs run weekly doubles
   round robins with rotating partners; game scores are generated from true skill.
   Hosts include some provisional ones and one adversarial host that inflates results.
   Seeded RNG; runs are reproducible.
2. Engine v0: evidence layer + policy layer + receipts, all parameters in config.
3. Metrics: prediction calibration (log loss / Brier), tracking error vs. true
   skill per cohort, lag for improvers, convergence from bad seeds, scale drift
   over multiple simulated years with the correction dial on and off, damage
   from the adversarial host.
4. Output: charts and sample receipts suitable for publishing.

## Open questions

- Exact dial parameters and who is exempt from correction.
- Score-margin model (how much an 11-3 counts vs. 11-9).
- Dispute resolution process (application-side, but affects engine inputs).
