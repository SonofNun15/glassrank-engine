# Community drift: plan to explore

Status: idea, not scheduled. Captured from design discussion, Nov 2026.

## The problem

Ratings are relative: within a group of players who mostly play each other,
every game moves rating points from one player to another, and the group's
average stays where it started. When a local community improves together
faster than the players around it, nobody in it has anyone to take points
from, so the whole group ends up rated below its real level. The reverse can
happen too: an isolated group can sit too high.

This hurts most when the group finally meets outsiders. Its players arrive
underrated, beat higher-rated teams, and the results look like anomalies
rather than what they are: evidence that the two communities' scales have
drifted apart.

The simulator already shows the general effect (all ratings drift low as the
community improves; see `sim-results-v0.md`). The local version, one isolated
improving community, is not yet modeled.

## Principles

- **Ratings change only through play.** No one's rating is bumped by decree,
  and a group is never shifted as a block.
- **Single games prove nothing.** Everyone has off days. The signal is a
  consistent pattern across many games, events, and players.
- **The players who travel are not a random sample.** They are often a
  community's strongest or fastest-improving members, and a community could
  send ringers out on purpose. One traveler's results must not be able to
  move a whole community.
- **Explainable and temporary.** Every adjustment appears in receipts, is
  backed by published evidence, and switches off when the evidence goes away.

## How rating points move today

Games between communities are the only way rating points enter or leave a
community. A traveling team that beats outsiders gains points there. Back
home, if they are really about as good as their clubmates, they lose some of
those points in local games, and the points spread through the community.
The mechanism already exists; it is just slow, because cross-community games
are rare and local spreading happens a little at a time.

## Proposed approach

### 1. Detect drift between communities

- Group players into communities by who plays whom (club membership to
  start; clustering of the play graph later).
- For every game between two communities, record the surprise: actual
  result minus expected, from both sides.
- Combine those surprises per pair of communities into an estimated offset
  with its uncertainty (for example, "+0.15 ± 0.05").
- Treat the offset as real only when it is backed by enough games, enough
  separate events, and **several different players** from the community,
  so one strong traveler or a planted ringer cannot trigger it.

### 2. Speed up the import channel: games between drifted communities count more

- While a pair of communities is flagged, games between them carry more
  weight (for example 1.4×).
- Keep it zero-sum: the outside opponents lose what the travelers gain. If
  the outside community is the larger, well-calibrated one, that loss spreads
  thinly across its players and fades.
- Works in both directions: a community that keeps underperforming outside
  loses points faster. This also drains ratings inflated by a dishonest host
  once those players compete elsewhere.

### 3. Speed up local spreading: slightly more volatility inside the flagged community

- While flagged, members' ratings respond a little faster (a small increase
  in per-event uncertainty), so points brought home by travelers spread
  through the community sooner.
- Only for the flagged community and only while flagged, so everyone else's
  ratings stay as steady as before.

### 4. Guardrails

- Minimum evidence before any flag: games, events, and distinct players.
- Caps on the weight increase and on how many points can move per period.
- Flags expire when the surprise in cross-community games disappears.
- Ringers: a player whose established rating is accurate shows no surprise,
  so gaming the flag requires several underrated players at once, which the
  distinct-player requirement and the trust layer are there to catch.

## Where it would live

Detection reads the whole history, so it cannot live inside `rate()`, which
sees one event at a time. Proposal: a separate open, pure module (for example
`@glassrank/network`) that reads the event log and produces a small,
published, versioned input listing flagged community pairs, their game
weights, flagged communities' volatility increase, and the evidence for each.
The engine applies it per game and records it in receipts, for example:

- "This game against Maple Street Rec counted 1.4× because your club's
  members have beaten Maple Street players more often than expected across
  38 games and 5 players."
- "Ratings at your club are temporarily more responsive while results with
  other clubs settle."

It belongs in the open (unlike cheating detection) because it changes
ratings. It also fits the scale goal in `sim-results-v0.md`: correct drift in
either direction instead of pretending to anchor the scale exactly.

## Experiment to run first

1. Add a "shark pool" scenario to the simulator: an isolated club of fast
   improvers with a few members who also play at other clubs.
2. Measure how far that community falls behind under current rules.
3. Compare four versions:
   - current rules;
   - volatility raised for everyone;
   - cross-community games always weighted more;
   - detection-triggered weighting plus raised volatility inside the flagged
     community (the proposal above).
4. Score each on:
   - how far behind the community falls and how fast it catches up;
   - whether outside communities get dragged down;
   - prediction accuracy and week-to-week noise for everyone else;
   - whether one deliberately underrated ringer can trigger a flag alone
     (it should not).

## Open questions

- How to define a community: club, region, or play-graph cluster, and what
  to do with players who belong to several.
- Thresholds for flagging, and how fast flags expire.
- Whether the weight increase should depend on the size of the estimated
  offset or be a fixed step.
- How this interacts with the correction dial, which addresses drift of the
  whole scale rather than between communities.
