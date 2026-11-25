import { Button, GlassPanel, RatingBadge, Tag, formatRating } from "@glassrank/design";
import { DEFAULT_RECIPE_V2, type PlayerHistory, type SimulationRecipeV2, type SimulationResultV2 } from "@glassrank/sim";
import { Check, ChartLine, Download, Link2, LoaderCircle, MessageSquareText, Play, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Design } from "../court/design/Design";
import { DriftSection } from "../court/DriftSection";
import { EventDetail, WhyPanel, type Namer } from "../court/PlayerWhy";
import { RatingChart, weekOf } from "../court/RatingChart";
import { decodeShare, encodeShare, hasShare } from "../sim/share";
import { useFollow, useSimulation } from "../sim/useSimulation";

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

const COMING: readonly { readonly title: string; readonly body: string; readonly now?: boolean }[] = [
  { title: "Start from scratch", body: "Begin with an empty world and build your own clubs, events, and players." },
  { title: "Share a link", body: "Share a simulation as a link. It's rebuilt exactly, down to every rating change, on anyone's screen." },
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
  const word = (n: number) => NUMBER_WORDS[n] ?? String(n);
  const leagues = recipe.events.filter((e) => e.format.type === "league").length;
  const divisions = recipe.events.length - leagues;
  const what = [
    leagues > 0 ? `${word(leagues)} round-robin league${leagues === 1 ? "" : "s"}` : null,
    divisions > 0 ? `${word(divisions)} tournament division${divisions === 1 ? "" : "s"}` : null,
  ]
    .filter((x) => x !== null)
    .join(" and ");
  const lead = `${count[0]?.toUpperCase()}${count.slice(1)} club${clubs === 1 ? "" : "s"} run${clubs === 1 ? "s" : ""} ${what} for ${weeks} weeks.`;
  const how = [
    leagues > 0 ? "Players choose which league night to play each week based on their GlassRank rating" : null,
    divisions > 0 ? "enter tournaments as teams of two" : null,
  ]
    .filter((x) => x !== null)
    .join(", and ");
  return `${lead} ${how[0]?.toUpperCase()}${how.slice(1)}.`;
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

type ShareState =
  | { readonly kind: "idle" }
  /** Design has changes that haven't been run: ask which simulation to share. */
  | { readonly kind: "choose" }
  | { readonly kind: "copied"; readonly ranChanges: boolean }
  | { readonly kind: "manual"; readonly url: string; readonly ranChanges: boolean };

const pageHash = () => (typeof window === "undefined" ? "" : window.location.hash);
/** The address without its fragment: the page a share link points at. */
const pageAddress = () => `${window.location.origin}${window.location.pathname}`;

export function TestCourt() {
  const [mode, setMode] = useState<Mode>("explore");
  // A share link in the address replaces the example; until it's read, nothing runs.
  const [ran, setRan] = useState<SimulationRecipeV2 | null>(() => (hasShare(pageHash()) ? null : DEFAULT_RECIPE_V2));
  const [draft, setDraft] = useState<SimulationRecipeV2>(DEFAULT_RECIPE_V2);
  const [player, setPlayer] = useState<string | null>(null);
  const [shared, setShared] = useState<{ readonly otherVersion: boolean } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [share, setShare] = useState<ShareState>({ kind: "idle" });
  const changed = ran !== null && draft !== ran;

  useEffect(() => {
    let current = true;
    const load = async () => {
      if (!hasShare(window.location.hash)) return;
      const r = await decodeShare(window.location.hash);
      if (!current) return;
      if (r.ok) {
        setRan(r.recipe);
        setDraft(r.recipe);
        setPlayer(r.player);
        setShared({ otherVersion: r.otherVersion });
        setLinkError(null);
        setMode("explore");
      } else {
        setLinkError(r.message);
        setShared(null);
        setRan((x) => x ?? DEFAULT_RECIPE_V2);
      }
    };
    void load();
    window.addEventListener("hashchange", load);
    return () => {
      current = false;
      window.removeEventListener("hashchange", load);
    };
  }, []);

  /** Run a new recipe: the address no longer describes what's on screen, so it drops the old link. */
  const runRecipe = (recipe: SimulationRecipeV2) => {
    setRan(recipe);
    setShared(null);
    setShare({ kind: "idle" });
    if (hasShare(window.location.hash)) window.history.replaceState(null, "", window.location.pathname);
  };

  /** Share `recipe`, which is what Explore shows (the last run, or changes just run for this). */
  const shareLink = async (recipe: SimulationRecipeV2, ranChanges: boolean) => {
    const fragment = await encodeShare(recipe, player);
    const url = `${pageAddress()}#${fragment}`;
    window.history.replaceState(null, "", `#${fragment}`);
    try {
      await navigator.clipboard.writeText(url);
      setShare({ kind: "copied", ranChanges });
    } catch {
      setShare({ kind: "manual", url, ranChanges });
    }
  };
  const onShare = () => {
    if (ran === null) return;
    // A link reproduces what Explore shows. With unrun changes in Design, ask which to share.
    if (changed) setShare({ kind: "choose" });
    else void shareLink(ran, false);
  };

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
              <Button variant="secondary" size="sm" disabled={ran === null} onClick={onShare} icon={<Link2 {...small} />}>
                Share link
              </Button>
              <Button variant="ghost" size="sm" disabled={ran === null} onClick={() => ran !== null && downloadRecipe(ran)} icon={<Download {...small} />}>
                Download recipe
              </Button>
            </div>
          </div>
          <div role="status" className="court__share-status">
            {share.kind === "choose" ? (
              <div className="court__notice">
                <p className="t-small">
                  You have changes in Design that haven't been run yet. A share link shows a simulation exactly as it ran, so pick which
                  one to share.
                </p>
                <div className="actions">
                  <Button
                    size="sm"
                    onClick={() => {
                      runRecipe(draft);
                      setMode("explore");
                      void shareLink(draft, true);
                    }}
                    icon={<Play {...small} />}
                  >
                    Run my changes and share
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => ran !== null && void shareLink(ran, false)}>
                    Share the last run
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShare({ kind: "idle" })}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : share.kind === "copied" ? (
              <p className="t-small">
                <Check {...small} /> Link copied: {share.ranChanges ? "your changes, just run" : "the simulation shown in Explore"}. Anyone who
                opens it sees this exact simulation{player !== null ? ", following the same player" : ""}.
                {!share.ranChanges && changed ? " Your unrun Design changes aren't in it." : ""}
              </p>
            ) : share.kind === "manual" ? (
              <label className="gr-field court__share-manual">
                <span className="gr-field__label">
                  Copy this link ({share.ranChanges ? "your changes, just run" : "the simulation shown in Explore"})
                </span>
                <input className="gr-input" readOnly value={share.url} onFocus={(e) => e.currentTarget.select()} />
              </label>
            ) : null}
          </div>
          {linkError !== null ? (
            <p className="court__notice" role="alert">
              Couldn't open that link. {linkError} Showing the example instead.
            </p>
          ) : null}
          {shared !== null ? (
            <div className="court__notice">
              <Tag tone="brand">Shared simulation</Tag>
              <p className="t-small">
                You're viewing a simulation someone shared with you, exactly as they saw it. Change anything you like.
                {shared.otherVersion ? " It was made with a different version of GlassRank, so the results may differ from what they saw." : ""}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  runRecipe(DEFAULT_RECIPE_V2);
                  setDraft(DEFAULT_RECIPE_V2);
                  setPlayer(null);
                }}
              >
                Back to the example
              </Button>
            </div>
          ) : null}
          <div role="tabpanel" id="panel-explore" aria-labelledby="tab-explore" hidden={mode !== "explore"}>
            {ran === null ? (
              <p className="court__status" role="status">
                <LoaderCircle {...icon} className="gr-icon spin" />
                Opening the shared simulation…
              </p>
            ) : (
              <Simulation recipe={ran} player={player} onPlayer={setPlayer} />
            )}
          </div>
          <div role="tabpanel" id="panel-design" aria-labelledby="tab-design" hidden={mode !== "design"}>
            <Design
              draft={draft}
              onChange={setDraft}
              changed={changed}
              onReset={() => setDraft(DEFAULT_RECIPE_V2)}
              onRun={() => {
                runRecipe(draft);
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
        <ul className="grid-2">
          {COMING.map((c) => (
            <li key={c.title} className="stack-xs">
              <h3 className="t-title court__coming-title">
                {c.title}
                {c.now === true ? <Tag tone="brand">Being built now</Tag> : null}
              </h3>
              <p className="muted-2">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Simulation(props: { readonly recipe: SimulationRecipeV2; readonly player: string | null; readonly onPlayer: (id: string) => void }) {
  const { recipe } = props;
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
  return <Results recipe={recipe} result={state.result} computeMs={state.computeMs} player={props.player} onPlayer={props.onPlayer} />;
}

function Results(props: {
  readonly recipe: SimulationRecipeV2;
  readonly result: SimulationResultV2;
  readonly computeMs: number;
  /** The followed player, kept by the page so share links can include it. */
  readonly player: string | null;
  readonly onPlayer: (id: string) => void;
}) {
  const { recipe, result, computeMs } = props;
  const labels = useMemo(() => labelsFor(recipe), [recipe]);
  const eventLabels = useMemo(() => Object.fromEntries(recipe.events.map((e) => [e.id, labels.event(e.id)])), [recipe, labels]);
  const namer = useMemo((): Namer => {
    const names = new Map(result.players.map((p) => [p.id, playerName(p, labels)]));
    return { player: (id) => names.get(id) ?? id, event: labels.event };
  }, [result, labels]);
  const followed = result.players.filter((p) => p.group === null);
  const fallback = followed[0]?.id ?? result.players[0]?.id ?? "";
  const selected = props.player !== null && result.players.some((p) => p.id === props.player) ? props.player : fallback;
  const setSelected = props.onPlayer;
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
    { value: result.world.leagueNights, label: "league nights" },
    ...(result.world.tournaments > 0 ? [{ value: result.world.tournaments, label: "tournament divisions" }] : []),
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
            {summarySentence(recipe, weeks)}
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

      {player !== null ? <PlayerView key={player.id} player={player} recipe={recipe} labels={labels} namer={namer} eventLabels={eventLabels} /> : null}
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

function PlayerView(props: {
  readonly player: PlayerHistory;
  readonly recipe: SimulationRecipeV2;
  readonly labels: Labels;
  readonly namer: Namer;
  readonly eventLabels: Readonly<Record<string, string>>;
}) {
  const { player, recipe, labels, namer } = props;
  const last = player.points.at(-1) ?? null;
  const name = playerName(player, labels);
  const follow = useFollow(recipe, player.id, props.eventLabels);
  // The open event, by id: the chart shows rated events only, the event list shows every event.
  const [picked, setPicked] = useState<string | null>(null);
  const report = follow.status === "done" ? follow.report : null;
  const pickFromChart = (i: number) => {
    setPicked(player.points[i]?.eventId ?? null);
    document.getElementById("event-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
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
        <RatingChart
          points={player.points}
          durationDays={recipe.durationDays}
          eventLabel={labels.event}
          title="Rating and true skill"
          subject={name}
          onPick={pickFromChart}
          picked={picked === null ? null : player.points.findIndex((p) => p.eventId === picked)}
        />
      ) : (
        <p className="muted-2">This player didn't play a rated event in this simulation.</p>
      )}
      {follow.status === "loading" ? (
        <p className="court__status" role="status">
          <LoaderCircle {...icon} className="gr-icon spin" />
          Gathering the details of every event they played…
        </p>
      ) : follow.status === "error" ? (
        <p className="court__status" role="alert">
          Couldn't load their event details: {follow.message}
        </p>
      ) : null}
      {report !== null ? (
        <>
          <WhyPanel report={report} namer={namer} />
          <div id="event-detail">
            <EventDetail
              report={report}
              namer={namer}
              index={picked === null ? null : report.events.findIndex((e) => e.eventId === picked)}
              onIndex={(i) => setPicked(i === null ? null : (report.events[i]?.eventId ?? null))}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
