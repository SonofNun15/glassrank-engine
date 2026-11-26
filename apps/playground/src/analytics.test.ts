import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Vars = { path: string; title?: string; referrer?: string; event?: boolean };

/** A fresh copy of the module (it remembers the last page) with a fake GoatCounter. */
async function load(loaded = true) {
  vi.resetModules();
  const sent: Vars[] = [];
  const listeners: (() => void)[] = [];
  const script = { addEventListener: (_: string, f: () => void) => listeners.push(f) };
  const win: { goatcounter?: { count?: (v: Vars) => void } } = loaded ? { goatcounter: { count: (v) => sent.push(v) } } : {};
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", { querySelector: () => script });
  const mod = await import("./analytics");
  const finishLoading = () => {
    win.goatcounter = { count: (v) => sent.push(v) };
    for (const f of listeners) f();
  };
  return { ...mod, sent, finishLoading };
}

describe("visit counting", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the referrer on the first page only, and counts each page once", async () => {
    const { countPage, sent } = await load();
    countPage("/glassrank-engine/", "Home");
    countPage("/glassrank-engine/", "Home");
    countPage("/glassrank-engine/test-court", "Test court");
    expect(sent).toEqual([
      { path: "/glassrank-engine/", title: "Home" },
      { path: "/glassrank-engine/test-court", title: "Test court", referrer: "" },
    ]);
  });

  it("sends actions by name only, as events", async () => {
    const { countAction, sent } = await load();
    countAction("send-feedback");
    expect(sent).toEqual([{ path: "send-feedback", title: "Opened the feedback form", referrer: "", event: true }]);
  });

  it("holds counts until the script loads", async () => {
    const { countPage, countAction, sent, finishLoading } = await load(false);
    countPage("/glassrank-engine/", "Home");
    countAction("share-link");
    expect(sent).toEqual([]);
    finishLoading();
    expect(sent.map((v) => v.path)).toEqual(["/glassrank-engine/", "share-link"]);
  });
});
