import { Button, GlassPanel, RatingBadge, Tag, formatRating } from "@glassrank/design";
import { DEFAULT_RECIPE_V2, type PlayerHistory, type SimulationRecipeV2, type SimulationResultV2 } from "@glassrank/sim";
import { ChartLine, Download, LoaderCircle, MessageSquareText, Play, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Design } from "../court/design/Design";
import { DriftSection } from "../court/DriftSection";
import { RatingChart, weekOf } from "../court/RatingChart";
import { useSimulation } from "../sim/useSimulation";

const icon = { className: "gr-icon", strokeWidth: 1.75, "aria-hidden": true } as const;
const small = { ...icon, width: 16, height: 16 } as const;

interface Labels {
  readonly club: (id: string) => string;
  readonly group: (id: string | null) => string;
  readonly event: (seriesId: string) => string;
}

function labelsFor(recipe: SimulationRecipeV2): Labels {
  const clubs = new Map(recipe.clubs.map((c) => [c.id, c.label ?? c.id]));
  const groups = new Map(recipe.groups.map((g) => [g.id, g.label ?? g.id]));
  const series = new Map(recipe.events.map((e) => [e.id, `${e.label ?? e.id}, ${clubs.get(e.club) ?? e.club}`]));
  return {
    club: (id) => clubs.get(id) ?? id,
    group: (id) => (id === null ? "Player" : (groups.get(id) ?? id)),
    event: (id) => series.get(id) ?? id,
  };
}

const COMING = [
  { title: "Edit events", body: "Add and change league nights and tournaments: their rating ranges, days, and which clubs they invite." },
  { title: "Start over", body: "Start from an empty world and build your own." },
  { title: "Share", body: "Share a simulation as a link. It's rebuilt exactly, down to every rating change, on anyone's screen." },
];

function playerName(p: PlayerHistory, labels: Labels): string {
  if (p.label !== null) return p.label;
  const n = Number(p.id.slice(p.id.lastIndexOf(".") + 1));
  return `${labels.group(p.group)} · #${n}`;
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

function summarySentence(recipe: SimulationRecipeV2, weeks: number): string {
  const clubs = recipe.clubs.length;
  const count = NUMBER_WORDS[clubs] ?? String(clubs);
  const leagues = recipe.events.length;
  const leagueCount = NUMBER_WORDS[leagues] ?? String(leagues);
  return `${count[0]?.toUpperCase()}${count.slice(1)} club${clubs === 1 ? "" : "s"} run${clubs === 1 ? "s" : ""} ${leagueCount} weekly league${leagues === 1 ? "" : "s"} for ${weeks} weeks.`;
}

function downloadRecipe(recipe: SimulationRecipeV2) {
  const blob = new Blob([`${JSON.stringify(recipe, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "glassrank-test-court-recipe.json";
  a.click();
  URL.revokeObjectURL(url);
}

type Mode = "explore" | "design";

export function TestCourt() {
  const [mode, setMode] = useState<Mode>("explore");
  const [ran, setRan] = useState<SimulationRecipeV2>(DEFAULT_RECIPE_V2);
  const [draft, setDraft] = useState<SimulationRecipeV2>(DEFAULT_RECIPE_V2);
  const changed = draft !== ran;

  return (
    <div className="page page-body stack">
      <div className="section-head">
        <span className="eyebrow">Test court</span>
        <h1 className="t-display-lg">Put GlassRank to the test</h1>
        <p className="t-body-lg lede">
          Watch GlassRank rate a simulated world of made-up clubs and players, where we know every player's true level. Explore
          the results, then change the world and run it again. Everything runs in your browser.
        </p>
      </div>

      <div className="court">
        <GlassPanel className="court__sim">
          <div className="court__toolbar">
            <div className="court__modes" role="tablist" aria-label="Test court mode">
              <button type="button" role="tab" id="tab-explore" aria-controls="panel-explore" aria-selected={mode === "explore"} className="court__mode" onClick={() => setMode("explore")}>
                <ChartLine {...small} />
                Explore results
              </button>
              <button type="button" role="tab" id="tab-design" aria-controls="panel-design" aria-selected={mode === "design"} className="court__mode" onClick={() => setMode("design")}>
                <SlidersHorizontal {...small} />
                Design the simulation
                {changed ? <span className="court__dot" aria-label="(unsaved changes)" /> : null}
              </button>
            </div>
            <div className="actions">
              <Button variant="ghost" size="sm" onClick={() => downloadRecipe(ran)} icon={<Download {...small} />}>
                Download recipe
              </Button>
            </div>
          </div>
          <div role="tabpanel" id="panel-explore" aria-labelledby="tab-explore" hidden={mode !== "explore"}>
            <Simulation recipe={ran} />
          </div>
          <div role="tabpanel" id="panel-design" aria-labelledby="tab-design" hidden={mode !== "design"}>
            <Design
              draft={draft}
              onChange={setDraft}
              changed={changed}
              onReset={() => setDraft(DEFAULT_RECIPE_V2)}
              onRun={() => {
                setRan(draft);
                setMode("explore");
              }}
            />
          </div>
        </GlassPanel>

        <aside className="court__feedback" aria-labelledby="feedback-title">
          <h2 id="feedback-title" className="t-title">
            Send feedback with this simulation
          </h2>
          <p className="muted-2">
            Found something that looks wrong, or right? Your feedback is sent together with the exact simulation on your screen, so
            we can rebuild what you saw and check it.
          </p>
          <Button disabled icon={<MessageSquareText {...icon} />}>
            Send feedback
          </Button>
          <p className="t-small muted">Feedback opens soon. Nothing is collected on this site yet.</p>
        </aside>
      </div>

      <section className="stack-sm" aria-labelledby="coming-title">
        <h2 id="coming-title" className="t-title">
          Coming next
        </h2>
        <ul className="grid-3">
          {COMING.map((c) => (
            <li key={c.title} className="stack-xs">
              <h3 className="t-title">{c.title}</h3>
              <p className="muted-2">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Simulation({ recipe }: { readonly recipe: SimulationRecipeV2 }) {
  const state = useSimulation(recipe);
  if (state.status === "running") {
    return (
      <p className="court__status" role="status">
        <LoaderCircle {...icon} className="gr-icon spin" />
        Simulating {recipe.clubs.length} clubs for {Math.round(recipe.durationDays / 7)} weeks…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="court__status" role="alert">
        The simulation couldn't run: {state.message}
      </p>
    );
  }
  return <Results recipe={recipe} result={state.result} computeMs={state.computeMs} />;
}

function Results(props: { readonly recipe: SimulationRecipeV2; readonly result: SimulationResultV2; readonly computeMs: number }) {
  const { recipe, result, computeMs } = props;
  const labels = useMemo(() => labelsFor(recipe), [recipe]);
  const followed = result.players.filter((p) => p.group === null);
  const [selected, setSelected] = useState(followed[0]?.id ?? result.players[0]?.id ?? "");
  const player = result.players.find((p) => p.id === selected) ?? null;

  const byClub = useMemo(() => {
    const out = new Map<string, PlayerHistory[]>();
    for (const p of result.players) if (p.group !== null) out.set(p.home, [...(out.get(p.home) ?? []), p]);
    return out;
  }, [result]);

  const weeks = weekOf(recipe.durationDays - 1);
  const stats = [
    { value: recipe.clubs.length, label: "clubs" },
    { value: result.world.players, label: "players" },
    { value: weeks, label: "weeks" },
    { value: result.world.events, label: "league nights" },
    { value: result.world.games, label: "games" },
  ];

  return (
    <div className="court__results">
      <section className="court__summary" aria-labelledby="summary-title">
        <div className="stack-xs">
          <h2 id="summary-title" className="t-title">
            In this simulation <span className="muted court__madeup">(all made up)</span>
          </h2>
          <p className="muted-2">
            {summarySentence(recipe, weeks)} Players choose which league night to play each week based on their GlassRank rating.
          </p>
        </div>
        <ul className="court__stats">
          {stats.map((s) => (
            <li key={s.label} className="court__stat">
              <span className="court__stat-value">{s.value.toLocaleString("en-US")}</span>
              <span className="court__stat-label">{s.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="court__follow stack-sm" aria-labelledby="follow-title">
        <div className="stack-xs">
          <h2 id="follow-title" className="t-title">
            Follow a player
          </h2>
          <p className="muted-2">See how their GlassRank rating moved, event by event, against the true skill only a simulation can know.</p>
        </div>
      <label className="gr-field court__picker" htmlFor="player">
        <span className="gr-field__label">Player</span>
        <select id="player" className="gr-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {followed.length > 0 ? (
            <optgroup label="Featured players (made up)">
              {followed.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerName(p, labels)}, {labels.club(p.home)}
                </option>
              ))}
            </optgroup>
          ) : null}
          {[...byClub].map(([club, players]) => (
            <optgroup key={club} label={labels.club(club)}>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerName(p, labels)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {player !== null ? <PlayerView player={player} recipe={recipe} labels={labels} /> : null}
      </section>

      <DriftSection
        players={result.players}
        name={(p) => playerName(p, labels)}
        club={labels.club}
        clubOrder={recipe.clubs.map((c) => c.id)}
        onFollow={(id) => {
          setSelected(id);
          document.getElementById("follow-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <p className="t-small muted court__note">
        <Play {...small} />
        Ran in {(computeMs / 1000).toFixed(1)} s in your browser, using the proposed GlassRank v1 rules (not yet adopted).
      </p>
    </div>
  );
}

function PlayerView(props: { readonly player: PlayerHistory; readonly recipe: SimulationRecipeV2; readonly labels: Labels }) {
  const { player, recipe, labels } = props;
  const last = player.points.at(-1) ?? null;
  const name = playerName(player, labels);
  return (
    <div className="stack-sm">
      <div className="court__player">
        <div className="stack-xs">
          <span className="t-title">{name}</span>
          <span className="t-small muted">
            {labels.club(player.home)}
            {player.group !== null ? ` · ${labels.group(player.group)}` : ""} · {player.points.length} rated events
          </span>
        </div>
        {last !== null ? (
          <div className="court__now">
            <div className="stack-xs">
              <span className="t-small muted">Rating at the end</span>
              <RatingBadge rating={last.rating} provisional={last.provisional} />
            </div>
            <div className="stack-xs">
              <span className="t-small muted">True skill (simulation only)</span>
              <span className="mono court__truth">{formatRating(last.trueSkill)}</span>
            </div>
          </div>
        ) : null}
      </div>
      {last !== null ? (
        <RatingChart points={player.points} durationDays={recipe.durationDays} eventLabel={labels.event} title="Rating and true skill" subject={name} />
      ) : (
        <p className="muted-2">This player didn't play a rated event in this simulation.</p>
      )}
    </div>
  );
}
