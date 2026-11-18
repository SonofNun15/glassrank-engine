/**
 * Golden summary of the default world. If the generator changes, this file
 * changes too: run `pnpm generate`, and say in the commit why the world moved.
 * A matching hash on another machine shows the run is byte-identical there.
 */
import { join } from "node:path";
import { hashCanonical } from "@glassrank/schema";
import { expect, it } from "vitest";
import { COHORTS, DEFAULT_SCENARIO } from "./scenario";
import { generateWorld } from "./world";

it("default world matches its golden summary", async () => {
  const world = generateWorld(DEFAULT_SCENARIO);
  const cohorts = Object.fromEntries(COHORTS.map((c) => [c, world.players.filter((p) => p.cohort === c).length]));
  const summary = {
    scenarioHash: hashCanonical(DEFAULT_SCENARIO),
    players: world.players.length,
    cohorts,
    events: world.events.length,
    games: world.events.reduce((n, e) => n + e.matches.reduce((g, m) => g + m.games.length, 0), 0),
    manipulatedGames: world.truth.manipulated.length,
    firstEvent: world.events[0]?.occurredAt,
    lastEvent: world.events.at(-1)?.occurredAt,
    seedsHash: hashCanonical(world.seeds),
    eventLogHash: hashCanonical(world.events),
  };
  await expect(`${JSON.stringify(summary, null, 2)}\n`).toMatchFileSnapshot(
    join(import.meta.dirname, "..", "golden", "default-world.json"),
  );
});
