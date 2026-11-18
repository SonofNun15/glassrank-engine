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

Policies are in `packages/sim/src/policies.ts`. Their numbers are untuned
starting points.

## Results

| Metric | elo | evidence | glassrank | + dial |
| --- | ---: | ---: | ---: | ---: |
| Log loss, all games (lower is better; coin flip 0.693) | 0.6685 | 0.6555 | 0.6555 | 0.6555 |
| Bias, fast improvers (rating - true) | -0.252 | -0.210 | -0.196 | -0.199 |
| Bias, slow decliners | -0.100 | -0.076 | -0.063 | -0.067 |
| Bias, returners' first 3 events back | +0.087 | +0.006 | +0.161 | +0.161 |
| RMSE, everyone | 0.240 | 0.228 | 0.217 | 0.219 |
| Bad seeds: median events to within 0.25 | 18 | 5 | 9 | 9 |
| Inflating host: favored players' bias | +0.221 | +0.222 | +0.238 | +0.235 |
| Drift at end of year 3 | -0.177 | -0.167 | -0.153 | -0.153 |
| Largest single drop | 0.167 | 0.551 | 0.200 | 0.200 |

## What this shows

- **The evidence layer predicts better than Elo** (M4 exit criterion). The gap
  widens in short runs, where Elo converges slowly from seeds.
- **The rules help improvers and decliners a little, and cap big drops.**
  Improver lag and decliner under-rating shrink compared with evidence only,
  and no event drops a rating by more than the 0.2 cap (evidence alone
  dropped one player 0.55 in an event).
- **Every system drifts low.** The simulated community improves on average,
  but ratings in a closed pool only measure players relative to each other,
  so absolute improvement does not show up. This is deflation, the opposite of
  the inflation the correction dial is designed for, and the dial (which
  makes losses count more) slightly worsens it here. Anchoring the scale
  against absolute skill is an open design question.
- **Costs of the protections are visible.** Returners are rated about 0.16
  high in their first three events back, and over-claimed self seeds take
  longer to come down (median 9 events versus 5).
- **Provisional-host weighting does not stop an inflating host.** Favored
  players end up about +0.22 too high in every system. Detecting this needs
  the trust layer (outside the engine) to void or down-weight results.

## Caveats

- One seed and one scenario; parameters are untuned.
- The world's skill model (S-curve rally probability with `k = 0.32`) is a
  guess, and calibration numbers depend on it.
- Bias numbers include the overall drift; compare cohorts against the
  "everyone" row, not against zero.
