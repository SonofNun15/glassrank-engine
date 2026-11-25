# Simulation results v0 (first comparison)

Default world (`DEFAULT_SCENARIO`, seed 1): 255 players, 1,248 events, 19,791
games over three years. Four systems, all fed the same events. Reproduce with
`pnpm sim`; the full numbers are in `packages/sim/golden/default-comparison.json`.

| System | What it is |
| --- | --- |
| elo baseline | Plain Elo on team averages, wins only, no rules |
| evidence only | `bayes_v0` with neutral rules (rating = evidence estimate) |
| glassrank | `bayes_v0` with the draft community rules |
| glassrank + dial | Same, with a one-year correction overlay in year 2 |

Policies are in `packages/sim/src/policies.ts`. The numbers in this document
are for the untuned v0 draft; the simulator now uses the v1 proposal
(`policy-v1-proposal.md`), so `pnpm sim` output differs from these tables.

## Results

| Metric | elo | evidence | glassrank | + dial |
| --- | ---: | ---: | ---: | ---: |
| Log loss, all games (lower is better; coin flip 0.693) | 0.6685 | 0.6555 | 0.6555 | 0.6555 |
| Bias, fast improvers (rating - true) | -0.252 | -0.210 | -0.196 | -0.199 |
| Bias, slow decliners | -0.100 | -0.076 | -0.063 | -0.067 |
| Bias, returners' first 3 events back | +0.087 | +0.006 | +0.141 | +0.141 |
| RMSE, everyone | 0.240 | 0.228 | 0.217 | 0.219 |
| Bad seeds: median events to within 0.25 | 18 | 5 | 5 | 5 |
| Inflating host: favored players' bias | +0.221 | +0.222 | +0.238 | +0.235 |
| Drift at end of year 3 | -0.177 | -0.167 | -0.153 | -0.153 |
| Largest single drop | 0.167 | 0.551 | 0.551 (provisional) | 0.551 (provisional) |

## What this shows

- **The evidence layer predicts better than Elo** (M4 exit criterion). The gap
  widens in short runs, where Elo converges slowly from seeds.
- **The rules help improvers and decliners a little, and cap big drops for
  established players.** Improver lag and decliner under-rating shrink
  compared with evidence only. After a player's 8 provisional events, no event
  drops a rating by more than the 0.2 cap; during the provisional period
  ratings follow the evidence, so early drops can be large (0.55 at most here).
- **Every system drifts low.** The simulated community improves on average,
  but ratings in a closed pool only measure players relative to each other,
  so absolute improvement does not show up. This is deflation, the opposite of
  the inflation the correction dial is designed for, and the dial (which
  makes losses count more) slightly worsens it here. Anchoring the scale
  against absolute skill is an open design question. Goal (Nov 2026): a given
  rating should consistently mean a similar level of play, accepting that true
  skill cannot be measured directly, so the scale will always be partly
  relative. That points toward detecting drift and correcting it in either
  direction, rather than exact anchoring.
- **Costs of the protections are visible.** Returners are rated about 0.14
  high in their first three events back. Before the provisional period was
  added, over-claimed seeds also took longer to come down (median 9 events
  versus 5); with it, they settle as fast as with evidence alone.
- **Provisional-host weighting does not stop an inflating host.** Favored
  players end up about +0.22 too high in every system. Detecting this needs
  the trust layer (outside the engine) to void or down-weight results.

## Starting ratings (follow-up experiment)

Self-reported starting ratings are the weak point: an overclaimed start comes
down slowly once damping and the decline cap apply. Same world and games,
varying only the seeds and a provisional period (first N events rated at
face value):

| Seeds | Provisional | Overclaimers: median events to settle | Year-1 RMSE | Year-1 drift | Honest players' year-1 bias | Largest drop |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Claims as in the default world | off | 15 | 0.280 | -0.035 | -0.004 | 0.20 |
| Claims as in the default world | 8 | 7 | 0.259 | -0.047 | -0.022 | 0.55 |
| Heavy overclaiming (+0.5 average) | off | 19 | 0.389 | +0.140 | +0.121 | 0.20 |
| Heavy overclaiming | 8 | 11 | 0.337 | +0.122 | +0.109 | 0.59 |
| Everyone starts at the default 3.0 | off | 5 | 0.642 | -0.580 | | 0.20 |
| Everyone starts at the default 3.0 | 8 | 2 | 0.663 | -0.597 | | 0.68 |

- A provisional period of 8 events halves the time an overclaimed start takes
  to settle and lowers first-year error, with no change later on. Its cost is
  large early drops. The draft GlassRank policy now uses 8.
- Widespread overclaiming inflates everyone, not just the overclaimers:
  honest players run about 0.12 high in the first year because they collect
  wins against overrated opponents. It washes out by year three. The
  provisional period helps only a little here.
- Starting everyone from the same number keeps the order of players about as
  right (log loss 0.6578 vs 0.6555) but the numbers lose their meaning: the
  whole scale sits about 0.6 low and never recovers, because a relative
  system cannot learn the absolute level it was never given.

Ideas not yet tested: shift each claimed-seed source by its measured average
overclaim (estimated from players who finish the provisional period, published
as a policy parameter); count games against provisional opponents for less in
established players' evidence, so overclaims leak less; and require
non-provisional ratings for rating-capped events, which removes the incentive
to overclaim.

## Caveats

- One seed and one scenario; parameters are untuned.
- The world's skill model (S-curve rally probability with `k = 0.32`) is a
  guess, and calibration numbers depend on it.
- Bias numbers include the overall drift; compare cohorts against the
  "everyone" row, not against zero.
