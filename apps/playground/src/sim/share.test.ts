import { DEFAULT_RECIPE_V2 } from "@glassrank/sim";
import { describe, expect, it } from "vitest";
import { decodeShare, encodeShare, hasShare } from "./share";

describe("share links", () => {
  it("round-trip a recipe and the followed player", async () => {
    const fragment = await encodeShare(DEFAULT_RECIPE_V2, "p.rosa");
    expect(hasShare(`#${fragment}`)).toBe(true);
    expect(fragment).toMatch(/^r1\.[A-Za-z0-9_-]+$/);
    const back = await decodeShare(`#${fragment}`);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const { createdWith: _, ...recipe } = back.recipe;
    const { createdWith: __, ...original } = DEFAULT_RECIPE_V2;
    expect(recipe).toEqual(original);
    expect(back.player).toBe("p.rosa");
    expect(back.otherVersion).toBe(false);
  });

  it("stay short: the default world fits in a couple of kilobytes", async () => {
    const fragment = await encodeShare(DEFAULT_RECIPE_V2);
    expect(fragment.length).toBeLessThan(3000);
  });

  it("explain damaged, foreign, and invalid links instead of failing", async () => {
    expect(await decodeShare("#nothing")).toMatchObject({ ok: false, message: expect.stringContaining("isn't a Test court share link") });
    expect(await decodeShare("#r1.not-really-compressed")).toMatchObject({ ok: false, message: expect.stringContaining("damaged") });
    const old = await encodeShare({ ...DEFAULT_RECIPE_V2, recipeVersion: "0.1.0" });
    expect(await decodeShare(old)).toMatchObject({ ok: false, message: expect.stringContaining("different version") });
    const broken = await encodeShare({ ...DEFAULT_RECIPE_V2, durationDays: 3 });
    expect(await decodeShare(broken)).toMatchObject({ ok: false, message: expect.stringContaining("isn't valid") });
  });

  it("flag links made with another engine or simulator version", async () => {
    const fragment = await encodeShare(DEFAULT_RECIPE_V2);
    const back = await decodeShare(fragment);
    if (!back.ok) throw new Error("expected ok");
    const older = { ...back.recipe, createdWith: { engineVersion: "0.0.1", simVersion: back.recipe.createdWith!.simVersion } };
    // Re-encode without restamping, the way an old link would arrive.
    const json = new TextEncoder().encode(JSON.stringify({ recipe: older }));
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(await decodeShare(`r1.${b64}`)).toMatchObject({ ok: true, otherVersion: true });
  });
});
