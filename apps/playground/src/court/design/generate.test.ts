import { parse } from "@glassrank/schema";
import { SimulationRecipeV2 } from "@glassrank/sim";
import { describe, expect, it } from "vitest";
import { totalPlayers, tournamentOf } from "./defaults";
import { DEFAULT_OPTIONS, generateWorld, type GenerateOptions } from "./generate";

const opts = (over: Partial<GenerateOptions> = {}): GenerateOptions => ({ ...DEFAULT_OPTIONS, seed: 7, ...over });

describe("generate a world", () => {
  it("is deterministic for the same dials and seed, and differs for another seed", () => {
    expect(generateWorld(opts())).toEqual(generateWorld(opts()));
    expect(generateWorld(opts({ seed: 8 }))).not.toEqual(generateWorld(opts()));
  });

  it("always makes a valid recipe, across every dial and many seeds", () => {
    const sizes = ["small", "medium", "large", "mixed"] as const;
    const levels = ["beginners", "mixed", "strong"] as const;
    const cultures = ["none", "one", "several"] as const;
    for (let seed = 1; seed <= 12; seed++) {
      for (const size of sizes) {
        for (const level of levels) {
          const clubs = 1 + (seed % 6);
          const r = generateWorld(opts({ seed, size, level, clubs, tournaments: cultures[seed % 3]!, travel: seed % 2 ? "homebodies" : "road-trippers" }));
          const result = parse(SimulationRecipeV2, r);
          expect(result.ok ? [] : result.issues.slice(0, 2), `${seed} ${size} ${level}`).toEqual([]);
          expect(r.clubs).toHaveLength(clubs);
        }
      }
    }
  });

  it("fits each club's leagues to its level", () => {
    const beginners = generateWorld(opts({ level: "beginners", size: "large", clubs: 1 }));
    const strong = generateWorld(opts({ level: "strong", size: "large", clubs: 1 }));
    const top = (r: ReturnType<typeof generateWorld>) =>
      Math.max(...r.events.filter((e) => e.format.type === "league").flatMap((e) => [e.range?.min ?? 0, e.range?.max ?? 0]));
    expect(top(strong)).toBeGreaterThan(top(beginners));
    expect(beginners.events.filter((e) => e.format.type === "league").length).toBeGreaterThanOrEqual(4);
  });

  it("follows the dials for size, tournaments, featured players, and length", () => {
    const small = generateWorld(opts({ size: "small", clubs: 2 }));
    const large = generateWorld(opts({ size: "large", clubs: 2 }));
    expect(totalPlayers(large)).toBeGreaterThan(totalPlayers(small));
    expect(generateWorld(opts({ tournaments: "none" })).events.some((e) => e.format.type === "tournament")).toBe(false);
    const several = generateWorld(opts({ tournaments: "several", clubs: 6, seed: 3 }));
    expect(new Set(several.events.map(tournamentOf).filter((t) => t !== null)).size).toBeGreaterThanOrEqual(1);
    expect(generateWorld(opts({ featured: false })).players).toEqual([]);
    expect(generateWorld(opts()).players.map((p) => p.id)).toEqual(["over-claimer", "fast-climber"]);
    expect(generateWorld(opts({ weeks: 26 })).durationDays).toBe(182);
  });
});
