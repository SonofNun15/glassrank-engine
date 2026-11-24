# Engine v0.1: as built (M3 to M5)

How `@glassrank/engine` implements the design in `engine-v0.md`. Every number
below is a policy parameter, not a constant in code.

## Public API

| Function | Notes |
| --- | --- |
| `rate(request)` | Validates a `RateRequest`, returns a `RateResponse`. `rateUnchecked` skips validation for callers that built the request themselves; both run the same code. |
| `predict(request)` | Win probability, expected point share, and expected score for one planned game. Uses the evidence model's forward function. |
| `replay(request)` | Folds `rate()` over an ordered event log, resolving the policy per event. Players without a prior start from a `policy_default` seed. |
| `resolvePolicy(schedule, at)` | Base config plus the active overlay at an instant. |

## Pipeline for one event

1. Build each participant's pre-event position from stored state, or from a
   seed (`policy_default` uses the policy's default rating and uncertainty).
2. Widen uncertainty for time away: after `graceDays`, sigma grows by
   `sigmaGrowthPerDay` per day, up to `sigmaMax`. There is no rating decay.
3. Evidence update for every player against the frozen pre-event estimates.
4. Policy rules turn the evidence into the displayed rating.
5. New state and a receipt for every participant, sorted by
   (discipline, playerId). Stored numbers are rounded to 1e-9.

Voided matches are skipped by the evidence layer and counted in receipts.
Each game's weight is the source-tier weight times the match's trust weight.

## Evidence models

**`elo_baseline`**: team rating is the mean of the players' estimates;
`P(win) = 1 / (1 + 10^(-gap / spread))`; each player moves by
`kFactor * weight * (result - P)` per game. Exists as the bar to beat.

**`bayes_v0`**: a Glicko-style approximate Bayesian update for doubles teams.
For each of a player's games, with `gap` the difference in team means:

- `P(win) = logistic(winScale * g * gap)` and expected point share
  `logistic(shareScale * g * gap)`, where `g` discounts for uncertainty in the
  other three players (Glicko's attenuation).
- The observation blends the win/loss result and the point share
  (`marginWeight`), so 11-3 says more than 11-9.
- Before the event, `dynamicsSigma` is added to the player's uncertainty.
  This keeps active players movable, so playing often does not freeze a
  rating.
- The posterior variance is the prior variance updated by each game's
  information; the mean moves by posterior variance times the summed
  gradient. Each game's contribution is reported in the receipt and they sum
  to the evidence change.

## Policy rules, in order

The displayed rating follows the evidence estimate, asymmetrically. Let `gap`
be the new estimate minus the current rating, and `change` this event's
change in the estimate.

0. **provisional_period**: for a player's first `events` events, the rating
   simply follows the evidence (no damping, cap, hold, or bias), so a wrong
   starting rating corrects at full speed. The cost is that early drops can be
   large; UIs should label these ratings provisional.

   While provisional, `RatingState.provisional` and the receipt headline carry
   `{ eventsRemaining, low, high }`: a likely range (the evidence estimate plus
   or minus `rangeSd` standard deviations, clamped to the scale) for apps to
   show instead of a single number. It is null once the player is
   established. The engine computes it so every client shows the same thing.
1. **upward_bias**: when `gap > 0`, catch up fully and add
   `(gainMultiplier - 1) * change` if `change > 0`.
2. **decline_damping**: when the result would be a drop, there is no drop if
   `change >= 0` (no drop after a good night); otherwise move
   `lossMultiplier` of the way down. Because each event closes part of the gap,
   an inflated rating converges back through play.
3. **returning_protection**: for `events` events after `awayDays` or more away,
   drops are multiplied again by its `lossMultiplier`.
4. **correction_overlay**: an active overlay replaces the base loss
   multiplier, except for exempt players (returning, or away at least the
   overlay's `exemptions.awayDays`).
5. **large_gain_hold**: gain above the threshold in an event with fewer than
   `minGamesToExceed` games is held.
6. **held_gain_release**: held gain is released when later evidence confirms
   it, and forfeited as far as later evidence contradicts it.
7. **decline_cap**: total drops inside the rolling `windowDays` window never
   exceed `amount`.
8. **scale_bounds**: the rating stays inside the policy's scale.

Every rule is recorded in the receipt with its input, output, and parameters,
whether or not it fired.

## Determinism

- `exp`, `ln`, and the logistic function come from stdlib-js
  (`@stdlib/math-base-special-*`), pure-JavaScript ports of FreeBSD msun, not
  `Math.exp`/`Math.log`, which engines may approximate differently.
  `Math.sqrt` is used directly; the spec requires it to be correctly rounded.
- Players are processed in sorted order; the result does not depend on the
  order of matches within an event (tested).
- `packages/engine/golden/` holds full input/output pairs. A port or another
  platform should reproduce them byte for byte.
