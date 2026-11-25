# Policy v1 proposal (M7)

Status: proposal from simulation only. Nov 2026. These settings are tuned to
GlassRank's simulated communities, not to real play; they are a starting
point for a pilot, where real results will retune them.

## The proposal

Evidence layer (`bayes_v0`):

| Setting | Draft | v1 | What it does |
| --- | ---: | ---: | --- |
| `winScale` | 3.2 | 2.4 | How strongly a rating gap predicts winning a game. Lower means each result moves the estimate less. |
| `shareScale` | 1.0 | 1.6 | How strongly a rating gap predicts the share of points won. |
| `marginWeight` | 0.5 | 0.8 | How much score margins count versus just win or loss. 11-3 now says much more than 11-9. |
| `dynamicsSigma` | 0.05 | 0.08 | Uncertainty added before every event, so active players stay easy to move. |

Community rules: unchanged from the draft (provisional period 8 events,
upward bias 1.2×, drops at 0.6× the gap, returning players protected for 3
events at 0.5×, decline cap 0.2 per 30 days, large-gain threshold 0.3 unless
6+ games).

## How it was chosen

1. **Tune the evidence layer for prediction.** A coordinate search over the
   four evidence settings, scored on how well pre-event ratings predict game
   results (log loss), on simulated worlds with seeds 1-3. It moved
   `winScale`, `shareScale`, and `marginWeight` and left `dynamicsSigma` at 0.05.
2. **Check on held-out worlds and other communities.** Seeds 4-6, across four
   community mixes: typical, growing (many newcomers and improvers), mature
   (mostly steady and declining players), and overclaiming (self-reported
   starting ratings about 0.5 high).
3. **Find the cost.** The prediction-optimal evidence layer is slower: each
   result moves the estimate less. That left fast improvers further behind
   in every community, against the goal of keeping up with improvement.
4. **Restore responsiveness.** Raising `dynamicsSigma` to 0.08 brought
   improver lag back to the draft's level while keeping most of the
   prediction gain. 0.11 helps improvers more but gives back more accuracy
   and lets more noise through in mature communities; 0.08 is the balance.
5. **Keep the draft rules.** The same search over the rules pushed almost
   every rule to the edge of its range (strongest upward bias, gentlest
   drops, smallest cap, longest provisional period). That fought the typical
   world's downward scale drift by making ratings sticky, and made things
   worse in communities without that drift. A rule set should not be a patch
   for one community's drift, so the draft rules stay until drift is handled
   on its own (see `community-drift.md` and the scale question in
   `sim-results-v0.md`).

## Results on held-out worlds (seeds 4-6, mean of 3)

Bias is rating minus true skill; negative means rated too low.

| Community | Setting | Prediction (log loss) | Error (RMSE) | Improver bias | Newcomer bias | Favored by inflating host | Events for a bad seed to settle | Largest drop |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Typical | draft | 0.6551 | 0.246 | -0.240 | -0.259 | +0.39 | 4.7 | 0.72 |
| Typical | **v1** | **0.6457** | **0.222** | -0.242 | **-0.199** | **+0.19** | 6.7 | **0.48** |
| Growing | draft | 0.6534 | 0.406 | -0.398 | -0.422 | +0.40 | 3.8 | 0.71 |
| Growing | **v1** | **0.6444** | **0.368** | -0.398 | **-0.344** | **+0.12** | 5.7 | **0.46** |
| Mature | draft | 0.6560 | 0.176 | -0.111 | -0.117 | +0.54 | 6.2 | 0.54 |
| Mature | **v1** | **0.6485** | **0.157** | -0.121 | **-0.060** | **+0.34** | 9.0 | **0.42** |
| Overclaiming | draft | 0.6582 | 0.231 | -0.062 | -0.091 | +0.57 | 7.0 | 0.80 |
| Overclaiming | **v1** | **0.6478** | **0.208** | -0.063 | **-0.029** | **+0.37** | 11.8 | **0.52** |

v1 is better in every community on prediction, overall error, newcomers,
damage from an inflating host, and the size of the largest drop, and matches
the draft for fast improvers.

## Costs and open issues

- **Bad starting ratings settle more slowly** (about 2 more events typically,
  almost 5 more when everyone overclaims), because each result moves the
  estimate less. Candidates: a longer provisional period, or the
  seed-correction ideas in `sim-results-v0.md`.
- **Scale drift is unchanged.** Growing communities still drift well below
  true skill (about -0.38 after three years) and mature ones slightly above.
  No setting here fixes that; it needs the drift work.
- **Score margins carry a lot of weight** (`marginWeight` 0.8). The simulator
  generates margins from skill, which may make margins look more informative
  than real games are. Check this against pilot data first.
- **Returners remain rated high** for their first events back (about +0.13),
  by design of the returning-player protection.

## Reproducing

```sh
pnpm sim:tune    # evidence and rule tuning, held-out seeds, community mixes (several minutes)
pnpm sim         # the default comparison with the v1 proposal
```
