/** One event series at a club: who can play, when, and how play is arranged. */
import { Button } from "@glassrank/design";
import { isEligible, type EventSeries, type SimulationRecipeV2 } from "@glassrank/sim";
import { Trash2, Users } from "lucide-react";
import { useId } from "react";
import { STRUCTURES, divisionName, rangeName, tournamentOf } from "./defaults";
import { More, NumberField, OptionalNumberField, RowDisclosure, SelectField, TextField } from "./fields";
import { ExtentFields, ScheduleFields, describeSchedule } from "./schedule";

const small = { className: "gr-icon", width: 16, height: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Set an optional field, or remove it when `value` is undefined. */
function withField<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): T {
  const next = { ...obj };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

const SCORING = [
  { value: "1-11", label: "One game to 11" },
  { value: "1-15", label: "One game to 15" },
  { value: "1-21", label: "One game to 21" },
  { value: "3-11", label: "Best of three, games to 11" },
  { value: "3-15", label: "Best of three, games to 15" },
] as const;
type ScoringKey = (typeof SCORING)[number]["value"];

export function Checkbox(props: { readonly label: string; readonly checked: boolean; readonly help?: string; readonly onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="gr-field design__check">
      <label htmlFor={id}>
        <input id={id} type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
        <span className="gr-field__label">{props.label}</span>
      </label>
      {props.help !== undefined ? <span className="gr-field__help">{props.help}</span> : null}
    </div>
  );
}

export function EventEditor(props: {
  readonly event: EventSeries;
  readonly recipe: SimulationRecipeV2;
  readonly onChange: (e: EventSeries) => void;
  readonly onRemove: () => void;
  readonly defaultOpen?: boolean;
  /** A tournament division: its tournament owns the schedule and who may enter. */
  readonly inTournament?: boolean;
  /** Every player's starting rating, to count who could enter. */
  readonly starts: readonly { readonly home: string; readonly rating: number }[];
}) {
  const { event: e, recipe, onChange } = props;
  const set = <K extends keyof EventSeries>(key: K, value: EventSeries[K] | undefined) => onChange(withField(e, key, value));
  const s = e.schedule;
  const scoring = e.scoring ?? { games: 1, to: 11, winBy: 2 };
  const scoringKey = `${scoring.games}-${scoring.to}`;
  const otherClubs = recipe.clubs.filter((c) => c.id !== e.club);
  // League-only and tournament-only settings.
  const league = e.format.type === "league" ? e.format : null;
  const tournament = e.format.type === "tournament" ? e.format : null;
  const setTournament = (next: NonNullable<typeof tournament>) => onChange({ ...e, format: next });
  const season = league?.season;
  const setLeague = (next: NonNullable<typeof league>) => onChange({ ...e, format: next });
  /** Change the range; a name that still matches the old range follows it. */
  const setRange = (bounds: { min?: number | undefined; max?: number | undefined }) => {
    const min = "min" in bounds ? bounds.min : e.range?.min;
    const max = "max" in bounds ? bounds.max : e.range?.max;
    const range = min === undefined && max === undefined ? undefined : { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
    const follows = e.label === undefined || e.label === rangeName(e.range);
    let next = withField(follows ? { ...e, label: rangeName(range) } : e, "range", range);
    // Play-up rules only mean something with a lowest rating.
    if (min === undefined) next = withField(withField(next, "playUp", undefined), "playUpMargin", undefined);
    onChange(next);
  };

  // Who could enter, by starting rating: the only ratings known before a run.
  const clubName = recipe.clubs.find((c) => c.id === e.club)?.label ?? e.club;
  const eligible = (r: number) => isEligible({ rating: r, high: r }, e);
  const inRange = (r: number) => (e.range?.min === undefined || r >= e.range.min) && (e.range?.max === undefined || r <= e.range.max);
  const home = props.starts.filter((p) => p.home === e.club);
  const away = props.starts.filter((p) => p.home !== e.club);
  const welcomed = away.filter((p) => e.onlyFrom?.includes(p.home) ?? true);
  const fit = {
    home: home.filter((p) => inRange(p.rating)).length,
    homeCan: home.filter((p) => eligible(p.rating)).length,
    away: welcomed.filter((p) => inRange(p.rating)).length,
    awayCan: welcomed.filter((p) => eligible(p.rating)).length,
  };
  const closed = e.onlyFrom !== undefined && e.onlyFrom.length === 0;

  const inTournament = props.inTournament === true;
  const prefix = inTournament ? `${tournamentOf(e) ?? ""}: ` : "";
  const meta = [
    tournament === null ? "Round-robin league" : (STRUCTURES.find((x) => x.value === tournament.structure)?.label ?? ""),
    e.label === rangeName(e.range) ? null : rangeName(e.range),
    inTournament ? null : describeSchedule(s),
    `up to ${e.capacity}${tournament === null ? "" : " teams"}`,
    closed ? `${fit.home} fit here` : `${fit.home} fit here · ${fit.away} from other clubs`,
    season === undefined ? null : `seasons of ${season.weeks} weeks`,
    inTournament || e.onlyFrom === undefined ? null : e.onlyFrom.length === 0 ? "home club only" : "some clubs only",
    e.rated === false ? "not rated" : null,
  ]
    .filter((x) => x !== null)
    .join(" · ");

  return (
    <li>
      <RowDisclosure title={<strong>{inTournament ? divisionName(e) : (e.label ?? e.id)}</strong>} meta={meta} {...(props.defaultOpen === undefined ? {} : { defaultOpen: props.defaultOpen })}>
      <div className="design__grid">
        {inTournament ? null : (
          <div className="gr-field">
            <span className="gr-field__label">Format</span>
            <span className="design__format">{tournament === null ? "Round-robin league" : "Tournament"}</span>
            <span className="gr-field__help">
              {tournament === null
                ? "Courts of four (or five), everyone partners everyone on their court, and players move up or down a court each week."
                : "Teams of two who sign up together."}
            </span>
          </div>
        )}
        {inTournament ? (
          <TextField label="Division name" value={divisionName(e)} maxLength={40} help="For example 3.5, or 4.5+." onChange={(name) => set("label", `${prefix}${name}`)} />
        ) : (
          <TextField label="Event name" value={e.label ?? ""} maxLength={60} onChange={(label) => set("label", label)} />
        )}
        <OptionalNumberField
          label="Lowest rating"
          value={e.range?.min}
          min={2}
          max={8}
          step={0.25}
          placeholder="No minimum"
          help="Leave empty for no minimum. Players below it may still play up (see More settings)."
          onChange={(min) => setRange({ min })}
        />
        <OptionalNumberField
          label="Highest rating"
          value={e.range?.max}
          min={2}
          max={8}
          step={0.25}
          placeholder="No maximum"
          help="Leave empty for no maximum. Players rated above it can't enter."
          onChange={(max) => setRange({ max })}
        />
      </div>
      <figure className="fit" aria-label={`Who fits ${rangeName(e.range)}`}>
        <table>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Players</span>
              </th>
              <th scope="col">
                Fit
                <span>rated {e.range === undefined ? "at any level" : `within ${rangeName(e.range)}`}</span>
              </th>
              <th scope="col">
                Could play
                <span>{e.range?.min === undefined ? "everyone allowed in" : "including playing up"}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                {clubName}
                <span>home club, {home.length} players</span>
              </th>
              <td className="fit__value">{fit.home}</td>
              <td className="fit__value">{fit.homeCan}</td>
            </tr>
            <tr>
              <th scope="row">
                Other clubs
                <span>
                  {closed
                    ? "not open to them"
                    : `${tournament === null ? "in weeks they travel" : "if they travel for tournaments"}, ${welcomed.length} players`}
                </span>
              </th>
              <td className="fit__value">{closed ? "–" : fit.away}</td>
              <td className="fit__value">{closed ? "–" : fit.awayCan}</td>
            </tr>
          </tbody>
        </table>
        <figcaption className="t-small muted">
          <Users {...small} /> By starting rating. Ratings change as people play, so these numbers shift over the run.
        </figcaption>
      </figure>
      <div className="design__grid">
        {inTournament ? null : <ScheduleFields schedule={s} durationDays={recipe.durationDays} onChange={(schedule) => onChange({ ...e, schedule })} />}
        <NumberField
          label={tournament === null ? "Most players" : "Most teams"}
          value={e.capacity}
          min={4}
          max={500}
          step={1}
          onChange={(capacity) => set("capacity", Math.round(capacity))}
        />
        {tournament !== null ? (
          <>
            <SelectField
              label="Structure"
              value={tournament.structure}
              options={STRUCTURES}
              help={STRUCTURES.find((x) => x.value === tournament.structure)?.help}
              onChange={(structure) => setTournament({ ...tournament, structure })}
            />
            {tournament.structure !== "double_elimination" ? (
              <NumberField
                label="Teams per pool"
                value={tournament.poolSize ?? 4}
                min={3}
                max={8}
                step={1}
                onChange={(n) => setTournament(withField(tournament, "poolSize", Math.round(n) === 4 ? undefined : Math.round(n)))}
              />
            ) : null}
            {tournament.structure === "pools_then_bracket" ? (
              <NumberField
                label="Teams from each pool to the bracket"
                value={tournament.advance ?? 2}
                min={1}
                max={4}
                step={1}
                onChange={(n) => setTournament(withField(tournament, "advance", Math.round(n) === 2 ? undefined : Math.round(n)))}
              />
            ) : null}
          </>
        ) : null}
      </div>
      <More>
        <div className="design__grid">
          {e.range?.min !== undefined ? (
            <SelectField
              label="Playing up"
              value={e.playUp ?? "open"}
              options={[
                { value: "open", label: "Anyone below the highest rating" },
                { value: "margin", label: "Up to a margin below the lowest" },
                { value: "strict", label: "Only from the lowest rating" },
              ]}
              help="Whether players rated below the lowest rating may enter."
              onChange={(rule) =>
                onChange(withField(withField(e, "playUp", rule === "open" ? undefined : rule), "playUpMargin", rule === "margin" ? (e.playUpMargin ?? 0.25) : undefined))
              }
            />
          ) : null}
          {e.playUp === "margin" ? (
            <NumberField label="Margin" value={e.playUpMargin ?? 0.25} min={0} max={3} step={0.05} help="How far below the lowest rating players may be." onChange={(m) => set("playUpMargin", m)} />
          ) : null}
          {e.range?.max !== undefined ? (
            <SelectField
              label="New players count by"
              value={e.provisional ?? "rating"}
              options={[
                { value: "rating", label: "Their rating" },
                { value: "high", label: "The top of their likely range" },
              ]}
              help="Which number has to be under the highest rating while a player is provisional."
              onChange={(p) => set("provisional", p === "rating" ? undefined : p)}
            />
          ) : null}
          {tournament?.structure === "double_elimination" ? null : (
          <SelectField<ScoringKey>
            label={tournament === null ? "Scoring" : "Pool scoring"}
            value={(SCORING.some((x) => x.value === scoringKey) ? scoringKey : "1-11") as ScoringKey}
            options={SCORING}
            onChange={(k) => {
              const [games, to] = k.split("-").map(Number) as [number, number];
              set("scoring", games === 1 && to === 11 ? undefined : { games, to, winBy: 2 });
            }}
          />
          )}
          {tournament !== null ? (
            <>
              <SelectField<ScoringKey>
                label={tournament.structure === "double_elimination" ? "Scoring" : "Bracket scoring"}
                value={(() => {
                  const b = tournament.bracketScoring ?? { games: 3, to: 11, winBy: 2 };
                  const k = `${b.games}-${b.to}`;
                  return (SCORING.some((x) => x.value === k) ? k : "3-11") as ScoringKey;
                })()}
                options={SCORING}
                onChange={(k) => {
                  const [games, to] = k.split("-").map(Number) as [number, number];
                  setTournament(withField(tournament, "bracketScoring", games === 3 && to === 11 ? undefined : { games, to, winBy: 2 }));
                }}
              />
              <SelectField
                label="Team eligibility"
                value={tournament.teamRule ?? "each"}
                options={[
                  { value: "each", label: "Both partners must be eligible" },
                  { value: "average", label: "The team's average rating must be" },
                ]}
                onChange={(rule) => setTournament(withField(tournament, "teamRule", rule === "each" ? undefined : rule))}
              />
            </>
          ) : null}
          {league !== null ? (
            <SelectField
              label="Court movement"
              value={String(league.movesPerCourt ?? 1)}
              options={[
                { value: "0", label: "Nobody moves" },
                { value: "1", label: "Top 1 up, bottom 1 down" },
                { value: "2", label: "Top 2 up, bottom 2 down" },
              ]}
              help="After each week, between neighbouring courts."
              onChange={(m) => setLeague(withField(league, "movesPerCourt", m === "1" ? undefined : Number(m)))}
            />
          ) : null}
          {inTournament ? null : <ExtentFields schedule={s} durationDays={recipe.durationDays} onChange={(schedule) => onChange({ ...e, schedule })} />}
        </div>
        <div className="design__grid">
          {league !== null ? (
            <Checkbox
              label="Players sign up for a season"
              checked={season !== undefined}
              help="Eligibility is checked when they sign up, then they stay for the season."
              onChange={(on) => setLeague(withField(league, "season", on ? { weeks: 10 } : undefined))}
            />
          ) : null}
          {season !== undefined ? (
            <NumberField
              label="Season length (weeks)"
              value={season.weeks}
              min={1}
              max={52}
              step={1}
              onChange={(w) => league !== null && setLeague({ ...league, season: { weeks: Math.round(w) } })}
            />
          ) : null}
          <Checkbox
            label="Rated by GlassRank"
            checked={e.rated ?? true}
            help="Unrated events still decide who plays where, but don't change ratings."
            onChange={(on) => set("rated", on ? undefined : false)}
          />
        </div>
        {!inTournament && otherClubs.length > 0 ? (
          <fieldset className="design__invites">
            <legend className="gr-field__label">Players from other clubs</legend>
            <Checkbox
              label="Open to every club"
              checked={e.onlyFrom === undefined}
              help="Most hosts welcome anyone. Players from other clubs consider this event in weeks they travel."
              onChange={(on) => set("onlyFrom", on ? undefined : [])}
            />
            {e.onlyFrom !== undefined ? (
              <>
                <span className="gr-field__help">Only these clubs, besides {clubName}:</span>
                {otherClubs.map((c) => (
                  <Checkbox
                    key={c.id}
                    label={c.label ?? c.id}
                    checked={e.onlyFrom?.includes(c.id) ?? false}
                    onChange={(on) => {
                      const list = on ? [...(e.onlyFrom ?? []), c.id] : (e.onlyFrom ?? []).filter((x) => x !== c.id);
                      set("onlyFrom", recipe.clubs.map((x) => x.id).filter((x) => list.includes(x)));
                    }}
                  />
                ))}
              </>
            ) : null}
          </fieldset>
        ) : null}
      </More>
      <div>
        <Button variant="ghost" size="sm" onClick={props.onRemove} icon={<Trash2 {...small} />}>
          {inTournament ? `Remove the ${divisionName(e)} division` : `Remove ${e.label ?? "event"}`}
        </Button>
      </div>
      </RowDisclosure>
    </li>
  );
}
