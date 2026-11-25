import { GlassPanel } from "@glassrank/design";
import { SOURCE_URL } from "../links";

const STEPS = [
  {
    title: "Rated by event, not by single game",
    body: "A round robin, ladder night, or tournament is rated as a whole. Everyone's rating going in is frozen, so one fluke game doesn't swing anything, while a consistent pattern of beating expectations does.",
  },
  {
    title: "First, the evidence",
    body: "A statistical estimate of how strong each player appears from results: who won, by how much, against whom, and how certain we are about everyone involved. Score margins count, so 11-3 says more than 11-9.",
  },
  {
    title: "Then, the community's rules",
    body: "Published rules turn the evidence into the rating you see: gains apply in full with a small upward bias, drops are softened and capped each month, returning players are protected, and new players start with a range.",
  },
  {
    title: "Finally, a receipt",
    body: "Every change records what the evidence said and what each rule did, with enough detail for anyone to recompute it and check the result.",
  },
];

export function HowItWorks() {
  return (
    <div className="page page-body stack">
      <div className="section-head">
        <span className="eyebrow">How it works</span>
        <h1 className="t-display-lg">Two layers, one receipt</h1>
        <p className="t-body-lg lede">
          GlassRank separates what the results say from the rules the community chooses, so every rating change can show both.
        </p>
      </div>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="step">
            <span className="step__num" aria-hidden="true">
              {i + 1}
            </span>
            <div className="stack-xs">
              <h2 className="t-title">{s.title}</h2>
              <p className="muted-2">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <GlassPanel>
        <h2 className="t-title">Nothing is secret</h2>
        <p className="muted-2">
          The rating engine, its data model, and the simulator used to test it are open source. Read the code, rerun the
          simulations, or propose an improvement on{" "}
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
      </GlassPanel>
    </div>
  );
}
