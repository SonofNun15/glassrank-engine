# Simulated world (M2)

`@glassrank/sim` generates a synthetic pickleball community: players with a
hidden true skill that changes over time, clubs running weekly doubles round
robins, and hosts that vouch for (or inflate) results. Its output is exactly
what a hosted service would hold, so the engine is tested through its real
inputs:

- `seeds`: one `Seed` per player (`self`, `host`, `external_claimed`, or
  `policy_default`), drawn from true skill plus a per-source bias and noise.
- `events`: `EventInput`s sorted by `(occurredAt, eventId)`.
- `truth`: true skill per player over time, cohorts, and every game an
  inflating host misreported. The engine never sees this; metrics (M3) do.

A world is a pure function of its `Scenario` (`DEFAULT_SCENARIO` in
`packages/sim/src/scenario.ts`). Every tunable number lives there.

## Model

- **Cohorts.** Fast improvers gain `gain * d / (d + halfLife)` over `d` days.
  New players do the same from a lower start and join throughout the run.
  Steady players stay flat. Slow decliners and the older pool lose a fixed
  amount per year. Returners take one layoff, come back rusty, and recover
  linearly. Skill is clamped to 2.0 to 8.0.
- **Clubs.** Each weekly event: members who are active and show up (per-player
  attendance probability) are grouped in fours by the host's perceived level
  (true skill plus noise); extras sit out. Each group plays three games so
  everyone partners everyone once. Per-event form noise is added to each
  player's skill.
- **Older pool.** One club only older-pool players belong to, plus a few
  bridge players who also belong to a regular club.
- **Hosts.** Verified and provisional tiers, plus one inflating host that
  reports close losses (by `maxMargin` or fewer) of teams with a favored
  member as wins.
- **Scores.** Each game is played rally by rally under side-out doubles rules
  (0-0-2 start, two servers, side outs, to 11 win by 2). The rally-win
  probability for team-skill gap `d` is `0.5 + 0.5 * k*d / (1 + k*|d|)`.
  With `k = 0.32`, a 0.25 gap wins about 67% of games, 0.5 about 83%, and 1.0
  about 95%, and margins grow with the gap.

## Determinism

The generator uses a seeded sfc32 generator and only basic arithmetic: no
`Math.exp`, `log`, or trig, whose last bits can differ between JavaScript
engines. Normal noise is Irwin-Hall (sum of 12 uniforms). Each club-week uses
its own forked random stream, so adding a club does not reshuffle the others.
`packages/sim/golden/default-world.json` records the default world's counts
and the hash of its full event log; a matching hash on another machine shows
the run is byte-identical there. Regenerate it with `pnpm generate` when the
generator changes on purpose.

## Known simplifications

- Doubles only; no singles events yet.
- Groups are exactly four; real round robins also run fives with byes.
- One game per match; no best-of-three.
- No serve advantage beyond what side-out scoring implies.
- Calibration of `k` is a starting guess, to revisit against real data.

## Simulation recipes

A `SimulationRecipe` (`packages/sim/src/recipe.ts`, JSON Schema in
`packages/sim/json-schema/`) holds everything needed to reproduce a run:
the community (cohorts, clubs, play and seed settings), up to 20 custom
players, one to four rating systems to compare (each a policy plus optional
correction overlays), the seed, start date, and length, and the engine and
simulator versions it was made with. Because runs are deterministic, a
recipe of a few kilobytes reproduces megabytes of results exactly.

- **Custom players** have a starting true skill plus optional improvement
  (total gain and half-life), yearly decline, and a layoff with rust; a
  claimed starting rating; home and other clubs; and optionally favor from an
  inflating home club. Their ids are `c-01`, `c-02`, ... and their labels are
  user content, never used in math.
- **Limits** are part of the format (260 weeks, 500 players, 20 custom
  players, 12 clubs, 4 systems), so a server can accept uploads safely.
- **`simulateRecipe(recipe)`** (or `glassrank simulate`) returns the world's
  size, each system's metrics report, every custom player's history, a hash
  of the recipe, and a hash of the whole result. Re-running a submitted recipe
  and comparing result hashes confirms the submitter saw exactly that result.
- Reproducing a recipe exactly needs the engine and simulator versions it was
  made with (`createdWith`).
