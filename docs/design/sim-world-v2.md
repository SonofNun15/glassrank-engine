# Simulated world v2: clubs, events, and eligibility

Status: step 1 built (`packages/sim/src/world-v2/`): recipe v0.2, true
skill presets and keyframes, keyed random streams, the weekly loop with
eligibility and appetite, and league round robins. Not yet built: inflating
clubs, tournaments and partnerships, ladders, and the new metrics. Replaces
the club model in `sim-world.md` once complete.

## Purpose

The Test court lets anyone see how the current official version of GlassRank
would rate made-up players in made-up clubs and events. It runs one
rating system: the latest official GlassRank policy. Until a policy is
adopted, that is the v1 proposal, and the Test court says so.

Comparing rating systems (plain Elo, policy variants, tuning) stays in the
`sim` package and CLI as research tooling. It is not a Test court feature.

v2 changes what the world is made of:

- **Clubs** whose players mostly play each other, with some travel
  between them.
- **True skill** described by preset curves or by keyframes drawn on a graph.
- **Events** with rating ranges. The GlassRank rating decides who may enter,
  so ratings change who plays where. That feedback is the main thing v2 adds.
- **Volatility** per player: how consistently they play at their true skill.

## Time

A run lasts `durationDays` from t0. The Test court shows only relative time
("day 45", "week 7"). Behind the scenes, day 0 is a fixed internal date (a
Monday), because the engine needs real timestamps and counts some limits in
calendar months. The internal date is not part of a recipe.

Changing the length of a run keeps everything before the change identical
(see Determinism).

## Clubs

A club is a first-class part of GlassRank: clubs run events and report their
results. In the simulation, a club is also the home of a group of players who
mostly play together. A club has:

- `id` and an optional `label` (made up; user content).
- `tier`: `verified_host` or `provisional_host`, as in the real service.
- Optionally `inflates`: it reports close losses of a few favored members as
  wins, as today.

Events belong to a club and can invite players from other clubs.
Independent organizers who run events without a venue are modeled as clubs
for now.

## Players

Every player has:

| Attribute | Meaning |
|---|---|
| `home` | Their home club. |
| `skill` | True skill over time: a preset curve or keyframes. |
| `volatility` | How far, typically, they play above or below their true skill. 0 means always exactly at true skill. |
| `travel` | 0 to 1: how likely they are, on a given week, to consider events outside their home club. Travel only decides *where* they look; it says nothing about level. |
| `appetite` | −1 to +1: how far above or below their own rating they like to play. −1 plays down, +1 plays up, 0 plays at their level. See Appetite. |
| `attendance` | Chance they play in a given week at all. |
| `tournaments` | How often they enter, or agree to partner in, a tournament they could play in. |
| `loyalty` | 0 to 1: how much they stick with one tournament partner. High keeps the same partner event after event; low means a new partner almost every time. |
| `joinDay` | When they start playing. |
| `inactive` | Optional periods away (injury, a break). |
| `startingRating` | Where their GlassRank rating starts: self-reported, club-assigned, or the default. |

### True skill: presets and keyframes

A player's true skill is either a preset or a list of keyframes.

**Presets** generate the curve from a few settings:

| Preset | Settings |
|---|---|
| Steady | level |
| Gradual improver | start, total gain, time to reach half of it |
| Fast improver | the same, with a shorter half time |
| Slow decline | start, loss per year |
| Break and return | start, when the break begins, its length, rust on return, recovery time |
| Plateau then jump | start, when the jump happens, its size, how long it takes |

**Keyframes** are `(day, skill)` points, joined by straight lines and held flat
after the last point. A preset can be converted to keyframes at any time,
which is what happens when someone drags a point on the graph. Detail is
there only for those who want it.

A break sets an `inactive` period as well as a keyframe dip, so the player
stops playing during it.

### Volatility

Each player's performance in a game is:

```
performance = true skill + night + match
night ~ Normal(0, volatility × √nightShare)     drawn once per event
match ~ Normal(0, volatility × √(1 − nightShare)) drawn per match
```

`nightShare` is a world setting (default 0.5). The total spread always equals
the player's volatility, so the setting means the same thing at any split. A
bad night drags down every match that evening; match-level noise varies within
it.

The game itself is random on top of this: the rally model (unchanged) turns
the gap between the two teams' average performance into a real score, so
even two players performing exactly at their true skill don't have a fixed
result.

**In the Test court**, volatility is a slider, not a number. Its labels run
Low, Medium, High, with one plain sentence beneath: "A more volatile player
sometimes plays above or below their true skill." The slider maps to the
spread behind the scenes:

| Slider position | Spread (standard deviation) | What it means |
|---|---|---|
| Far left | 0 | Always plays at their true skill. |
| Low | 0.05 | Almost always plays at their level. |
| Medium | 0.15 | Has good and bad days. |
| High | 0.30 | Hard to predict: some days well above, some well below. |

The slider moves continuously between these points; the label shown is the
nearest one. `nightShare` is not shown; it stays at the world default. The
recipe stores the number, so research tooling and exported recipes keep full
precision.

### Appetite

Appetite is relative, so it needs a fixed reference. The reference is **half
a rating point**, about the width of one event bracket (3.0–3.5, 3.5–4.0).
Half a point is enough to make games noticeably harder or easier without
making them lopsided; a full point apart usually means blowouts.

Each time a player chooses an event, they draw a target level:

```
target = rating + appetite × 0.5 + Normal(0, appetiteSpread)
```

`appetiteSpread` is a world setting (default 0.25), so the same player
sometimes reaches a little higher or settles a little lower than usual. A
player at 3.4 with appetite +1 usually aims near 3.9, but some weeks aims at
3.6 or 4.2. With appetite 0, they aim at their own rating, give or take.

An event's **level** is the midpoint of its range. An event with only a
`max` has level `max − 0.25`, one with only a `min` has level `min + 0.25`,
and one with no range (all levels) has the player's own rating as its level.

The target is only a preference: eligibility rules come first, so a player
who wants to play down can never enter an event whose `max` they exceed.

Appetite and travel are independent. Travel decides which clubs' events a
player looks at this week; appetite decides which level they pick from
those.

**In the Test court**, appetite is a slider, like volatility, so people can
set it by feel without knowing the formula. Its labels run from "Plays
down" through "Plays at their level" to "Plays up", with one plain sentence
beneath: "Some players like easy wins; others look for tougher games." The
slider maps to −1 to +1 behind the scenes:

| Slider position | Appetite | What it means |
|---|---|---|
| Far left | −1 | Plays down: picks events where they're among the strongest. |
| Left of center | −0.5 | Leans down: prefers to be near the top of an event. |
| Center | 0 | Plays at their level. |
| Right of center | +0.5 | Leans up: likes a challenge. |
| Far right | +1 | Plays up: seeks events above their level. |

The label shown is the nearest one. `appetiteSpread` is not shown; it stays
at the world default. The recipe stores the number.

### Player groups

Most players come from **groups**, which draw many players from ranges:

```
"Improving newcomers": 40 players, home "north", preset gradual improver,
start 2.4–3.0, gain 0.6–1.2, half time 90–300 days, volatility 0.10–0.25,
travel 0–0.15, appetite −0.3–0.5, attendance 0.5–0.9, join day 0–365
```

The v0.1 cohorts become built-in group templates. A hand-made player is a
group of one with exact values, and is followed by name in the results.

## Events

**Players decide where they play.** Clubs set each event's rating range and
arrange play inside the event (courts, pools, seeding), always by GlassRank
rating and results. They don't place players by eye or move them between
events.

Every event series has:

| Field | Meaning |
|---|---|
| `club` | Which club runs and reports it (and so its tier). |
| `invites` | Clubs whose players may enter: the running club's own, plus others. |
| `schedule` | Weekly on a weekday, every N weeks, or once on a given day. |
| `range` | `{ min?, max? }` in GlassRank rating. |
| `playUp` | `open` (any rating below `max` may enter), `margin` (up to X below `min`), or `strict` (must be at least `min`). Default `open`. |
| `capacity` | Maximum players (or teams, for tournaments). |
| `rated` | Whether results are submitted to GlassRank. Default true; ladders default false. |
| `format` | One of the formats below, with its settings. |
| `scoring` | Games per match (1 or best of 3), points to win (11, 15, or 21), win by 2. Default one game to 11. Tournaments can set it per stage. |

Eligibility always uses the player's **current GlassRank rating** at entry
time. A provisional player uses their provisional rating; an event may choose
the stricter `high` option, using the top of the provisional range.

### League round robin (`league`)

The most common rated format: a weekly league night.

- Players are split into courts of four (five, with byes, when the numbers
  don't divide evenly). On each court everyone partners everyone else once.
- The first week, courts are filled by GlassRank rating.
- After that, courts carry over: the top finisher on each court (by the
  standard order; see Standings) moves up a
  court the next week and the bottom finisher moves down
  (`movesPerCourt`, default 1). Players returning after missing weeks, and
  new players, slot in by rating.
- Optional `season`: players register for a run of weeks, and eligibility is
  checked at registration, as real leagues do. Without it, eligibility is
  checked each week.

### Ladder (`ladder`)

Informal and usually not rated, but it can be.

- Starting courts are filled by GlassRank rating.
- After each game, the winners move up a court and the losers move down;
  partners split, so every game has new pairs. Winners on the top court and
  losers on the bottom court stay.
- The night runs a fixed number of games (`games`, default 8).

### Tournaments (`tournament`)

Players enter as **teams of two who sign up together**. Partners are chosen
by the players before they register, not by the organizer:

1. **Their current partner first.** A player who decides to enter (see
   `tournaments`) and has a current partner asks them first, with
   probability equal to their `loyalty`. Otherwise they look for someone
   new.
2. **Someone they already play with.** New partners come from people they
   already play with: members of their home club and players they've shared
   a court with, preferring those whose rating is close to their own target
   level (see Appetite). Former partners they broke up with are left out,
   except rarely: each former partner is included with probability
   `reunion` (world setting, default 0.05), and then ranks last.
3. The partner agrees with probability equal to their own `tournaments`
   value, and only if the team is eligible. If they decline, the player asks
   the next choice, up to three asks.
4. A hand-made player can name a fixed `partner`, who is always asked first
   and never broken up with.
5. Rarely, a player registers as **needing a partner** (`soloEntry`, a world
   setting, default 3% of entries, and also the fallback when every ask
   fails). The organizer pairs solo entrants with each other, closest in
   rating; any left over don't play.

**Partnerships last and end.** A team that plays a tournament together
becomes each player's current partner. After each tournament the pair may
break up. Broken-up pairs rarely team up again (see `reunion` above):

- **After a rough event**, they break up with probability `roughBreakup`
  (world setting, default 0.6). An event is rough when the team won less
  than a third of its matches, or won at least 1.5 fewer matches than
  their true skills predicted.
- **Otherwise**, they break up with probability `(1 − loyalty) × 0.3`,
  using the less loyal partner's `loyalty`.

So loyal players build long partnerships, players who struggle to find a
good fit change partners almost every event, and a bad day can end even a
long partnership.

A team's eligibility uses `teamRule`: `each` (both players at or below
`max`, the default) or `average`.

A tournament runs one of three structures:

- **`pools`**: large pools; every team plays every other team in its pool.
  Standing follows the standard order (see Standings).
- **`pools_then_bracket`**: smaller pools, then the top `advance` teams from
  each pool are seeded into a single-elimination bracket by their pool
  results.
- **`double_elimination`**: a single bracket seeded by GlassRank rating.
  Losing in the main draw drops a team into the back draw, where it plays
  until it loses again.

How medals are decided (for example, whether the back-draw winner gets a
rematch) varies by organizer. Ratings use only match results, so the first
version plays every match and records no placements.

### Standings

Wherever a format ranks players or teams (pool standings, bracket seeding
from pools, who moves up or down a league court), it uses the standard
pickleball order:

1. Most wins.
2. Head-to-head wins among the tied teams only (with three or more tied,
   their wins against each other).
3. Most points scored.
4. Fewest points scored against.
5. Still tied: drawn by lot, from the event occurrence's seeded stream.

In a league round robin, partners change every game, so the order ranks
individual players by the games they won and the points their teams
scored and allowed. Head-to-head counts only the games where the tied
players were on opposite sides.

## How a week runs

For each week, in day order:

1. **Who plays.** Each active player who has joined plays this week with
   probability `attendance`. Separately, when a tournament is open for entry,
   they consider it with probability `tournaments`.
2. **Which events they consider.** Their home club's events, plus, with
   probability `travel`, events at other clubs that invite them.
3. **Eligibility.** Drop events whose `max` they exceed, and those whose
   `playUp` rule they fail. A league with seasons only accepts registrations
   at the start of a season.
4. **Choice.** Draw this entry's target level from the player's appetite
   (see Appetite) and pick the eligible event whose level is nearest to it.
   Ties go to the home club, then by seed.
5. **Capacity.** Full events turn players away to their next choice, in a
   random order fixed by the seed.
6. **Play.** Each event arranges play by its format, plays its matches, and,
   if rated, the engine rates it.
7. **Ratings update** before the next event, so the next week's eligibility
   reflects them.

## What the feedback loop shows

Because ratings decide eligibility, the simulation shows effects a fixed
schedule hides:

- **Underrated players** enter events below their level, win often, and
  rise until they pass the event's `max`. Until then, every win costs their
  opponents rating, pulling that event's pool down.
- **Play-down players** sit just under a ceiling on purpose. Their wins are
  against weaker teams and count for little.
- **Play-up players** lose more often but cheaply; improvers rise quickly.
- **Overrated players** lose in events above their level and drop, and may
  fall below the floor of events they used to enter.
- **Travelers** carry rating information between clubs (see
  `community-drift.md`).

New metrics, alongside the existing ones:

- **Time to bracket:** days until a misrated player's rating is within the
  range of the events that fit their true skill.
- **Pool drift:** each event series' average rating minus its players'
  average true skill, over time.
- **Pinned players:** players within a small margin below a `max` for many
  weeks.
- **Wrong-bracket entries:** entries whose true skill is above the event's
  `max`.

## Determinism

Randomness is drawn from separate streams keyed by what they are for, not
consumed in one sequence:

- player attributes: `(group, index)`
- a player's weekly attendance, travel, and choice: `(player, week)`
- an event occurrence's capacity order, night form, matches, and rallies:
  `(series, occurrence)`

So extending a run leaves every earlier week byte-identical, and editing one
player changes only what that player touches. Ratings still feed back: if a
change moves someone into another event, that event's later games differ.

The fixed internal start date and the rally model's arithmetic follow the
existing rules (no `Math.exp` or trig in the generator).

## Recipe v0.2

```jsonc
{
  "recipeVersion": "0.2.0",
  "name": "Two towns and a tournament",
  "seed": 1,
  "durationDays": 730,
  "world": { "nightShare": 0.5, "play": { "rallyK": 0.32, "target": 11, "winBy": 2 } },
  "clubs": [
    { "id": "north", "label": "Northside Rec (made up)", "tier": "verified_host" }
  ],
  "groups": [
    { "label": "Improving newcomers", "count": 40, "home": "north",
      "skill": { "preset": "gradual_improver", "start": [2.4, 3.0], "gain": [0.6, 1.2], "halfDays": [90, 300] },
      "volatility": [0.1, 0.25], "travel": [0, 0.15], "appetite": [-0.3, 0.5],
      "attendance": [0.5, 0.9], "joinDay": [0, 365],
      "startingRating": { "self": 0.5, "club": 0.2, "default": 0.3, "selfBias": 0.2, "sd": 0.4 } }
  ],
  "players": [
    { "label": "Rosa (made up)", "home": "north",
      "skill": { "keyframes": [[0, 3.0], [200, 3.6], [730, 3.7]] },
      "volatility": 0.2, "travel": 0.1, "appetite": -0.6, "attendance": 0.8,
      "joinDay": 0, "startingRating": { "self": 3.5 } }
  ],
  "events": [
    { "id": "north-35", "club": "north", "invites": ["north"],
      "schedule": { "weekly": 1 }, "range": { "min": 3.0, "max": 3.5 },
      "playUp": "open", "capacity": 24,
      "format": { "type": "league", "movesPerCourt": 1, "season": { "weeks": 10 } } },
    { "id": "fall-classic-35", "club": "north", "invites": ["north", "south"],
      "schedule": { "onDay": 280 }, "range": { "max": 3.5 }, "capacity": 32,
      "format": { "type": "tournament", "structure": "pools_then_bracket", "poolSize": 4, "advance": 2, "teamRule": "each" },
      "scoring": { "pools": { "games": 1, "to": 11 }, "bracket": { "games": 3, "to": 11 } } }
  ],
  "createdWith": { "engineVersion": "0.1.0", "simVersion": "0.2.0", "policyId": "…" }
}
```

A recipe has no rating-system list: the Test court always runs the official
policy, recorded in `createdWith` so a submitted recipe reproduces exactly.
Research tooling may pass a different policy when it runs a recipe, without
changing the recipe.

**Limits** (proposed): 5 years, 500 players, 12 clubs, 40 event series,
20 groups, 20 hand-made players, 24 keyframes per player.

**Migration from v0.1:** each club keeps its tier and inflation flag and gets one
weekly open event; cohorts become groups from the matching templates; custom
players become hand-made players with a preset; `systems` is dropped (the
first system's policy is noted, not used). The current generator stays
available for research runs until v2 has its own goldens.

## Test court

- Opens on a large ready-made world: four or five clubs of different
  levels and sizes, a ladder of rated events in each, an all-levels night, a
  quarterly tournament that draws from every club, and every kind of
  player, run for two years. Visitors browse before changing anything.
- Visitors then change a variable on a player, group, club, or event,
  add an event, or draw a new skill curve, and rerun.
- Runs happen off the main thread (a Web Worker). Target: the default world
  in a few seconds on a mid-range laptop; to be measured.
- Player settings use plain words, not formulas. Volatility is a Low,
  Medium, High slider (see Volatility); travel, appetite, attendance,
  tournaments, and loyalty get the same treatment ("Stays home" to
  "Travels often", "Plays down" to "Plays up", "Now and then" to "Every
  week", "Rarely" to "Most weekends", "New partner most events" to "Same
  partner every time"). Numbers appear only in the
  exported recipe and an optional details view.
- Every chart shows true skill (simulation only) beside the GlassRank rating.
- Export downloads the recipe; feedback sends the recipe with it.

## Open questions

- Whether "won 1.5 fewer matches than predicted" is the right line for a
  rough event that can end a partnership.
- Whether the default world's size fits the time target in a browser. We
  find out by building it and measuring.

## Build order

1. League round robin with court movement and seasons (the common rated
   format), with players, clubs, and event choice.
2. Tournament `pools` and `pools_then_bracket`, with team entry.
3. `double_elimination`.
4. Ladder.
5. Measure the default world in a browser worker and size it to fit.

## Implementation notes (step 1)

- Player ids are `<group id>.<n>` for generated players and `p.<id>` for
  hand-made ones, so the two can never collide.
- Lengthening a run leaves every *full* earlier week identical. The last,
  partial week of a shorter run can differ, because events past the end are
  dropped and players then choose differently that week.
- League courts of five sit at the bottom. When extra players can't all
  join a court (6, 7, or 11 players), the last to sign up sit out.
- Players sign up at the start of each week, using their rating at that
  moment, and play at most one event per week.
- `runWorldV2(recipe, schedule)` takes any policy schedule, so research
  tooling can run the same recipe under other rating systems.
