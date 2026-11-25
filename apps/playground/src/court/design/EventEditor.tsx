/** One event series at a club: who can play, when, and how play is arranged. */
import { Button } from "@glassrank/design";
import { isEligible, type EventSeries, type SimulationRecipeV2 } from "@glassrank/sim";
import { Trash2, Users } from "lucide-react";
import { useId } from "react";
import { rangeName } from "./defaults";
import { More, NumberField, OptionalNumberField, RowDisclosure, SelectField, TextField } from "./fields";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const small = { className: "gr-icon", width: 16, height: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Set an optional field, or remove it when `value` is undefined. */
function withField<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): T {
  const next = { ...obj };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

type Often = "1" | "2" | "4" | "once";
const SCORING = [
  { value: "1-11", label: "One game to 11" },
  { value: "1-15", label: "One game to 15" },
  { value: "1-21", label: "One game to 21" },
  { value: "3-11", label: "Best of three, games to 11" },
  { value: "3-15", label: "Best of three, games to 15" },
] as const;
type ScoringKey = (typeof SCORING)[number]["value"];

function Checkbox(props: { readonly label: string; readonly checked: boolean; readonly help?: string; readonly onChange: (v: boolean) => void }) {
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
  /** Every player's starting rating, to count who could enter. */
  readonly starts: readonly { readonly home: string; readonly rating: number }[];
}) {
  const { event: e, recipe, onChange } = props;
  const set = <K extends keyof EventSeries>(key: K, value: EventSeries[K] | undefined) => onChange(withField(e, key, value));
  const weeks = Math.ceil(recipe.durationDays / 7);
  const s = e.schedule;
  const weekday = s.kind === "weekly" ? s.weekday : s.day % 7;
  const often: Often = s.kind === "once" ? "once" : (String(s.everyWeeks ?? 1) as Often);
  const scoring = e.scoring ?? { games: 1, to: 11, winBy: 2 };
  const scoringKey = `${scoring.games}-${scoring.to}`;
  const otherClubs = recipe.clubs.filter((c) => c.id !== e.club);
  const season = e.format.season;
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

  const setSchedule = (next: { often?: Often; weekday?: number; week?: number }) => {
    const o = next.often ?? often;
    const d = next.weekday ?? weekday;
    if (o === "once") {
      const week = next.week ?? (s.kind === "once" ? Math.floor(s.day / 7) + 1 : 1);
      onChange({ ...e, schedule: { kind: "once", day: Math.min(recipe.durationDays - 1, (week - 1) * 7 + d) } });
      return;
    }
    const base = s.kind === "weekly" ? s : { kind: "weekly" as const, weekday: d };
    const every = Number(o);
    let schedule: EventSeries["schedule"] = { ...base, weekday: d };
    schedule = every === 1 ? withField(schedule, "everyWeeks", undefined) : { ...schedule, everyWeeks: every };
    onChange({ ...e, schedule });
  };

  const when =
    s.kind === "once"
      ? `once, week ${Math.floor(s.day / 7) + 1}`
      : `${(s.everyWeeks ?? 1) === 1 ? "" : (s.everyWeeks === 2 ? "every other " : `every ${s.everyWeeks} weeks on `)}${WEEKDAYS[s.weekday]}${(s.everyWeeks ?? 1) === 1 ? "s" : ""}`;
  const meta = [
    "Round-robin league",
    e.label === rangeName(e.range) ? null : rangeName(e.range),
    when,
    `up to ${e.capacity}`,
    closed ? `${fit.home} fit here` : `${fit.home} fit here · ${fit.away} from other clubs`,
    season === undefined ? null : `seasons of ${season.weeks} weeks`,
    e.onlyFrom === undefined ? null : e.onlyFrom.length === 0 ? "home club only" : "some clubs only",
    e.rated === false ? "not rated" : null,
  ]
    .filter((x) => x !== null)
    .join(" · ");

  return (
    <li>
      <RowDisclosure title={<strong>{e.label ?? e.id}</strong>} meta={meta} {...(props.defaultOpen === undefined ? {} : { defaultOpen: props.defaultOpen })}>
      <div className="design__grid">
        <div className="gr-field">
          <span className="gr-field__label">Format</span>
          <span className="design__format">Round-robin league</span>
          <span className="gr-field__help">
            Courts of four (or five), everyone partners everyone on their court, and players move up or down a court each week. Tournaments and ladders are
            coming.
          </span>
        </div>
        <TextField label="Event name" value={e.label ?? ""} maxLength={60} onChange={(label) => set("label", label)} />
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
                <span>{closed ? "not open to them" : `in weeks they travel, ${welcomed.length} players`}</span>
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
        <SelectField
          label="Day"
          value={String(weekday)}
          options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
          onChange={(d) => setSchedule({ weekday: Number(d) })}
        />
        <SelectField<Often>
          label="How often"
          value={often}
          options={[
            { value: "1", label: "Every week" },
            { value: "2", label: "Every other week" },
            { value: "4", label: "Every four weeks" },
            { value: "once", label: "Once" },
          ]}
          onChange={(o) => setSchedule({ often: o })}
        />
        {s.kind === "once" ? (
          <NumberField label="In week" value={Math.floor(s.day / 7) + 1} min={1} max={weeks} step={1} onChange={(week) => setSchedule({ week: Math.round(week) })} />
        ) : null}
        <NumberField label="Most players" value={e.capacity} min={4} max={500} step={1} onChange={(capacity) => set("capacity", Math.round(capacity))} />
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
          <SelectField<ScoringKey>
            label="Scoring"
            value={(SCORING.some((x) => x.value === scoringKey) ? scoringKey : "1-11") as ScoringKey}
            options={SCORING}
            onChange={(k) => {
              const [games, to] = k.split("-").map(Number) as [number, number];
              set("scoring", games === 1 && to === 11 ? undefined : { games, to, winBy: 2 });
            }}
          />
          <SelectField
            label="Court movement"
            value={String(e.format.movesPerCourt ?? 1)}
            options={[
              { value: "0", label: "Nobody moves" },
              { value: "1", label: "Top 1 up, bottom 1 down" },
              { value: "2", label: "Top 2 up, bottom 2 down" },
            ]}
            help="After each week, between neighbouring courts."
            onChange={(m) => onChange({ ...e, format: withField(e.format, "movesPerCourt", m === "1" ? undefined : Number(m)) })}
          />
          {s.kind === "weekly" ? (
            <>
              <NumberField
                label="Starts in week"
                value={(s.firstWeek ?? 0) + 1}
                min={1}
                max={weeks}
                step={1}
                onChange={(w) => onChange({ ...e, schedule: withField(s, "firstWeek", w <= 1 ? undefined : Math.round(w) - 1) })}
              />
              <NumberField
                label="Ends after week"
                value={(s.lastWeek ?? weeks - 1) + 1}
                min={1}
                max={weeks}
                step={1}
                help="Set it to the last week to run to the end."
                onChange={(w) => onChange({ ...e, schedule: withField(s, "lastWeek", w >= weeks ? undefined : Math.round(w) - 1) })}
              />
            </>
          ) : null}
        </div>
        <div className="design__grid">
          <Checkbox
            label="Players sign up for a season"
            checked={season !== undefined}
            help="Eligibility is checked when they sign up, then they stay for the season."
            onChange={(on) => onChange({ ...e, format: withField(e.format, "season", on ? { weeks: 10 } : undefined) })}
          />
          {season !== undefined ? (
            <NumberField
              label="Season length (weeks)"
              value={season.weeks}
              min={1}
              max={52}
              step={1}
              onChange={(w) => onChange({ ...e, format: { ...e.format, season: { weeks: Math.round(w) } } })}
            />
          ) : null}
          <Checkbox
            label="Rated by GlassRank"
            checked={e.rated ?? true}
            help="Unrated events still decide who plays where, but don't change ratings."
            onChange={(on) => set("rated", on ? undefined : false)}
          />
        </div>
        {otherClubs.length > 0 ? (
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
          Remove {e.label ?? "event"}
        </Button>
      </div>
      </RowDisclosure>
    </li>
  );
}
