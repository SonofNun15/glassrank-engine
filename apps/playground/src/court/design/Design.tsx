/**
 * Design mode: change the simulated world, then run it again. Every edit
 * makes a new recipe; the draft is checked against the recipe format before
 * it can run.
 */
import { Button } from "@glassrank/design";
import { GLASSRANK, RECIPE_V2_LIMITS, SimulationRecipeV2, startingRatings, type PlayerSpec } from "@glassrank/sim";
import { parse } from "@glassrank/schema";
import { CircleAlert, Play, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { ClubCard } from "./ClubCard";
import { NEW_CLUB, addClub, newClubPlayers, newPlayer, removeClub, totalPlayers } from "./defaults";
import { PlayerCard } from "./PlayerCard";

const icon = { className: "gr-icon", width: 16, height: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Problems with a draft, in plain words. */
export function draftProblems(draft: SimulationRecipeV2): string[] {
  const result = parse(SimulationRecipeV2, draft);
  if (result.ok) return [];
  const names = new Map<string, string>([
    ...draft.players.map((p, i) => [`/players/${i}`, p.label ?? p.id] as const),
    ...draft.groups.map((g, i) => [`/groups/${i}`, g.label ?? g.id] as const),
    ...draft.clubs.map((c, i) => [`/clubs/${i}`, c.label ?? c.id] as const),
    ...draft.events.map((e, i) => [`/events/${i}`, e.label ?? e.id] as const),
  ]);
  return result.issues.map((issue) => {
    const owner = [...names.keys()].filter((k) => issue.path.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    const where = owner === undefined ? "" : `${names.get(owner)}: `;
    if (issue.path === "/events" && issue.message.includes("at least")) return "The world needs at least one event. Add a club to get one.";
    if (issue.message.includes("after the end of the run")) return `${where}a true-skill point is after the end of the run. Make the run longer or move the point.`;
    return `${where}${issue.message}`;
  });
}

const withoutPartner = (p: PlayerSpec): PlayerSpec => {
  const { partner: _, ...rest } = p;
  return rest;
};

/** Make `id` and `partner` each other's fixed partners, freeing anyone either was paired with. */
export function pairPlayers(players: readonly PlayerSpec[], id: string, partner: string | null): PlayerSpec[] {
  const old = new Set([id, partner, players.find((x) => x.id === id)?.partner, partner === null ? undefined : players.find((x) => x.id === partner)?.partner]);
  return players.map((x) => {
    const freed = old.has(x.id) || (x.partner !== undefined && old.has(x.partner)) ? withoutPartner(x) : x;
    if (partner === null) return freed;
    if (x.id === id) return { ...freed, partner };
    if (x.id === partner) return { ...freed, partner: id };
    return freed;
  });
}

export function Design(props: {
  readonly draft: SimulationRecipeV2;
  readonly onChange: (next: SimulationRecipeV2) => void;
  readonly onRun: () => void;
  readonly onReset: () => void;
  readonly changed: boolean;
}) {
  const { draft, onChange } = props;
  const problems = useMemo(() => draftProblems(draft), [draft]);
  // Starting ratings for "who could enter" counts; generating players is cheap and plays no games.
  const starts = useMemo(() => (problems.length > 0 ? [] : startingRatings(draft, GLASSRANK.seeding.defaultRating)), [draft, problems]);
  // Players and clubs added in this session open by default; the rest start collapsed.
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const markAdded = (id: string | undefined) => id !== undefined && setAdded((s) => new Set([...s, id]));
  const weeks = Math.round(draft.durationDays / 7);
  const total = totalPlayers(draft);
  const canAddPlayer = draft.players.length < RECIPE_V2_LIMITS.maxHandMadePlayers && total < RECIPE_V2_LIMITS.maxPlayers;
  const canAddClub =
    draft.clubs.length < RECIPE_V2_LIMITS.maxClubs &&
    draft.events.length + NEW_CLUB.leagues.length <= RECIPE_V2_LIMITS.maxEvents &&
    draft.groups.length + NEW_CLUB.groupCounts.length <= RECIPE_V2_LIMITS.maxGroups &&
    total + newClubPlayers() <= RECIPE_V2_LIMITS.maxPlayers;
  const canAddGroup = draft.groups.length < RECIPE_V2_LIMITS.maxGroups && total + 10 <= RECIPE_V2_LIMITS.maxPlayers;

  return (
    <div className="stack-sm design">
      <div className="design__bar">
        <p className="t-small muted" role="status">
          {problems.length > 0
            ? "Fix the problems below to run the simulation."
            : props.changed
              ? "You have changes that haven't been run yet."
              : "Change something, then run the simulation again."}
        </p>
        <div className="actions">
          <Button variant="secondary" size="sm" onClick={props.onReset} icon={<RotateCcw {...icon} />}>
            Reset to the example
          </Button>
          <Button size="sm" onClick={props.onRun} disabled={problems.length > 0} icon={<Play {...icon} />}>
            Run simulation
          </Button>
        </div>
      </div>

      {problems.length > 0 ? (
        <div className="design__problems" role="alert">
          <CircleAlert {...icon} />
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="design__section" aria-labelledby="length-title">
        <h3 id="length-title" className="t-title">
          Length
        </h3>
        <div className="gr-field design__slider">
          <label className="gr-field__label" htmlFor="weeks">
            How long it runs: <span className="design__value">{weeks} weeks</span>
          </label>
          <input id="weeks" type="range" min={8} max={104} step={1} value={weeks} onChange={(e) => onChange({ ...draft, durationDays: Number(e.target.value) * 7 })} />
          <span className="gr-field__help">Making it longer keeps every earlier week exactly the same.</span>
        </div>
      </section>

      <section className="design__section" aria-labelledby="featured-title">
        <div className="design__section-head">
          <div className="stack-xs">
            <h3 id="featured-title" className="t-title">
              Featured players (made up)
            </h3>
            <p className="t-small muted">
              Players you design yourself and can follow by name. {draft.players.length} of {RECIPE_V2_LIMITS.maxHandMadePlayers}.
            </p>
          </div>
          <Button variant="secondary" size="sm" disabled={!canAddPlayer} onClick={() => {
            const p = newPlayer(draft);
            markAdded(`player:${p.id}`);
            onChange({ ...draft, players: [...draft.players, p] });
          }} icon={<Plus {...icon} />}>
            Add a featured player
          </Button>
        </div>
        {draft.players.length === 0 ? <p className="muted-2">No featured players. Add one, perhaps a player like you.</p> : null}
        <ul className="design__cards">
          {draft.players.map((p) => (
            <PlayerCard
              key={p.id}
              player={p}
              recipe={draft}
              defaultOpen={added.has(`player:${p.id}`)}
              onChange={(next) => onChange({ ...draft, players: draft.players.map((x) => (x.id === p.id ? next : x)) })}
              onRemove={() =>
                onChange({
                  ...draft,
                  players: draft.players.filter((x) => x.id !== p.id).map((x) => (x.partner === p.id ? withoutPartner(x) : x)),
                })
              }
              onPartner={(partner) => onChange({ ...draft, players: pairPlayers(draft.players, p.id, partner) })}
            />
          ))}
        </ul>
      </section>

      <section className="design__section" aria-labelledby="clubs-title">
        <div className="design__section-head">
          <div className="stack-xs">
            <h3 id="clubs-title" className="t-title">
              Clubs and their players
            </h3>
            <p className="t-small muted">
              {draft.clubs.length} of {RECIPE_V2_LIMITS.maxClubs} clubs · {draft.events.length} of {RECIPE_V2_LIMITS.maxEvents} events ·{" "}
              {total} of {RECIPE_V2_LIMITS.maxPlayers} players in all. A new club starts with four leagues and about 40 players of every kind.
            </p>
          </div>
          <Button variant="secondary" size="sm" disabled={!canAddClub} onClick={() => {
            const next = addClub(draft);
            markAdded(`club:${next.clubs.at(-1)?.id}`);
            onChange(next);
          }} icon={<Plus {...icon} />}>
            Add a club
          </Button>
        </div>
        <ul className="design__clubs">
          {draft.clubs.map((c) => (
            <ClubCard
              key={c.id}
              club={c}
              recipe={draft}
              defaultOpen={added.has(`club:${c.id}`)}
              canRemove={draft.clubs.length > 1}
              canAddGroup={canAddGroup}
              canAddEvent={draft.events.length < RECIPE_V2_LIMITS.maxEvents}
              canAddTournament={draft.events.length + 4 <= RECIPE_V2_LIMITS.maxEvents}
              starts={starts}
              onChange={onChange}
              onRemove={() => onChange(removeClub(draft, c.id))}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
