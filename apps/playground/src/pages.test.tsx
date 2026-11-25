import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { Home } from "./pages/Home";
import { HowItWorks } from "./pages/HowItWorks";
import { NotFound } from "./pages/NotFound";
import { TestCourt } from "./pages/TestCourt";
import { Waitlist } from "./pages/Waitlist";

describe("pages render", () => {
  it("home: the pitch, a live receipt, evidence, and calls to action", () => {
    const html = renderToString(<App />);
    for (const text of [
      "Pickleball ratings you can see through",
      "Put GlassRank to the test",
      "Try to break it",
      "Open the Test court",
      "Join the waitlist",
      "Beat 1 higher-rated team.",
      "Why ratings feel broken",
      "What GlassRank does differently",
      "New players get a range, not a number",
      "17% closer",
      "You win your event and still lose rating",
      "Closer to how people actually play",
      "Ratings that belong to the community",
      "We plan to form a nonprofit",
      "No clubs use GlassRank yet",
      "The players, club, and games are made up",
      "Sample round robin (made up)",
      "Source code",
    ]) {
      expect(html, text).toContain(text);
    }
  });

  it.each([
    ["how it works", HowItWorks, "Two layers, one receipt"],
    ["test court", TestCourt, "Put GlassRank to the test"],
    ["waitlist", Waitlist, "Join the waitlist"],
    ["not found", NotFound, "Page not found"],
  ])("%s", (_name, Page, heading) => {
    expect(renderToString(<Page />)).toContain(heading);
  });

  it("never claims the nonprofit exists or that anyone uses GlassRank today", () => {
    const html = renderToString(<App />);
    for (const claim of [/run by a nonprofit/i, /preparing a pilot/i, /proven/i, /GlassRank rates the/i, /dishonest/i]) {
      expect(html, String(claim)).not.toMatch(claim);
    }
  });

  it("puts feedback inside the Test court, with the simulation", () => {
    const html = renderToString(<TestCourt />);
    expect(html).toContain("Send feedback with this simulation");
    expect(html).toContain("Nothing is collected on this site yet");
  });

  it("test court has explore and design modes", () => {
    const html = renderToString(<TestCourt />);
    expect(html).toContain("Explore results");
    expect(html).toContain("Design the simulation");
    expect(html).toContain("Run simulation");
    expect(html).toContain("Featured players (made up)");
    expect(html).toContain("Share link");
  });

  it("offers the waitlist in the header and footer on every page", () => {
    const html = renderToString(<App />);
    expect(html.match(/href="\/waitlist"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("home has exactly one top-level heading", () => {
    expect(renderToString(<Home />).match(/<h1/g)).toHaveLength(1);
  });
});
