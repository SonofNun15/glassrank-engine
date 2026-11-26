import { DEFAULT_RECIPE_V2 } from "@glassrank/sim";
import { describe, expect, it } from "vitest";
import { FEEDBACK_FORM, MAX_FORM_URL, feedbackLink, playerLabel } from "./feedback";

describe("feedback form link", () => {
  it("pre-fills the share link and the player", () => {
    const share = "https://example.org/test-court#r1.abc_-";
    const { url, linkIncluded } = feedbackLink(share, "Rosa (made up)");
    expect(linkIncluded).toBe(true);
    const params = new URL(url).searchParams;
    expect(url.startsWith(`${FEEDBACK_FORM.url}?`)).toBe(true);
    expect(params.get("usp")).toBe("pp_url");
    expect(params.get(FEEDBACK_FORM.linkEntry)).toBe(share);
    expect(params.get(FEEDBACK_FORM.playerEntry)).toBe("Rosa (made up)");
  });

  it("leaves the player blank when no one is followed", () => {
    const params = new URL(feedbackLink("https://example.org/#r1.x", null).url).searchParams;
    expect(params.has(FEEDBACK_FORM.playerEntry)).toBe(false);
  });

  it("drops a link too long for Google to pre-fill, keeping the player", () => {
    const { url, linkIncluded } = feedbackLink(`https://example.org/#r1.${"a".repeat(MAX_FORM_URL)}`, "Sam (made up)");
    expect(linkIncluded).toBe(false);
    expect(url.length).toBeLessThan(MAX_FORM_URL);
    const params = new URL(url).searchParams;
    expect(params.has(FEEDBACK_FORM.linkEntry)).toBe(false);
    expect(params.get(FEEDBACK_FORM.playerEntry)).toBe("Sam (made up)");
  });
});

describe("player labels", () => {
  it("name featured players by their label", () => {
    const rosa = DEFAULT_RECIPE_V2.players.find((p) => p.id === "rosa");
    expect(playerLabel(DEFAULT_RECIPE_V2, "p.rosa")).toBe(rosa?.label);
  });

  it("name generated players by group, number, and club", () => {
    const group = DEFAULT_RECIPE_V2.groups[0]!;
    const club = DEFAULT_RECIPE_V2.clubs.find((c) => c.id === group.home)!;
    expect(playerLabel(DEFAULT_RECIPE_V2, `${group.id}.007`)).toBe(`${group.label ?? group.id} · #7, ${club.label ?? club.id}`);
  });

  it("are null for players the recipe doesn't have", () => {
    const group = DEFAULT_RECIPE_V2.groups[0]!;
    expect(playerLabel(DEFAULT_RECIPE_V2, "nobody.1")).toBeNull();
    expect(playerLabel(DEFAULT_RECIPE_V2, "p.nobody")).toBeNull();
    expect(playerLabel(DEFAULT_RECIPE_V2, `${group.id}.${group.count + 1}`)).toBeNull();
  });
});
