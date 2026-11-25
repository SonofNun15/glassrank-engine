/**
 * Design mode: change the simulation, then run it again. This first version
 * edits the run's length and the featured players; clubs, events, and player
 * groups are shown and become editable next.
 */
import { Button, Tag, formatRating } from "@glassrank/design";
import type { PlayerSpec, SimulationRecipeV2 } from "@glassrank/sim";
import { Play, RotateCcw } from "lucide-react";
import { useId } from "react";
import { APPETITE_STOPS, VOLATILITY_STOPS, nearestStop, positionOf, valueAt, type Stop } from "./sliders";

const icon = { className: "gr-icon", strokeWidth: 1.75, "aria-hidden": true } as const;
const WEEKDAYS = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];
const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;

function ScaleSlider(props: { readonly label: string; readonly stops: readonly Stop[]; readonly value: number; readonly onChange: (v: number) => void }) {
  const id = useId();
  const position = Math.round(positionOf(props.stops, props.value));
  const stop = nearestStop(props.stops, position);
  return (
    <div className="gr-field design__slider">
      <label className="gr-field__label" htmlFor={id}>
        {props.label}: <span className="design__value">{stop.label}</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={position}
        aria-valuetext={stop.label}
        onChange={(e) => props.onChange(round(valueAt(props.stops, Number(e.target.value)), 3))}
      />
      <div className="design__ends t-small muted" aria-hidden="true">
        <span>{props.stops[0]?.label}</span>
        <span>{props.stops.at(-1)?.label}</span>
      </div>
      <span className="gr-field__help">{stop.meaning}</span>
    </div>
  );
}

function rangeText(range: { min?: number; max?: number } | undefined): string {
  if (range?.min !== undefined && range.max !== undefined) return `${range.min.toFixed(1)}–${range.max.toFixed(1)}`;
  if (range?.max !== undefined) return `${range.max.toFixed(1)} and under`;
  if (range?.min !== undefined) return `${range.min.toFixed(1)} and up`;
  return "All levels";
}

export function Design(props: {
  readonly draft: SimulationRecipeV2;
  readonly onChange: (next: SimulationRecipeV2) => void;
  readonly onRun: () => void;
  readonly onReset: () => void;
  readonly changed: boolean;
}) {
  const { draft, onChange } = props;
  const clubLabel = new Map(draft.clubs.map((c) => [c.id, c.label ?? c.id]));
  const weeks = Math.round(draft.durationDays / 7);
  const setPlayer = (id: string, patch: Partial<PlayerSpec>) =>
    onChange({ ...draft, players: draft.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  return (
    <div className="stack-sm design">
      <div className="design__bar">
        <p className="t-small muted">{props.changed ? "You have changes that haven't been run yet." : "Change something, then run the simulation again."}</p>
        <div className="actions">
          <Button variant="secondary" size="sm" onClick={props.onReset} icon={<RotateCcw {...icon} width={16} height={16} />}>
            Reset to the example
          </Button>
          <Button size="sm" onClick={props.onRun} icon={<Play {...icon} width={16} height={16} />}>
            Run simulation
          </Button>
        </div>
      </div>

      <section className="design__section" aria-labelledby="length-title">
        <h3 id="length-title" className="t-title">Length</h3>
        <div className="gr-field design__slider">
          <label className="gr-field__label" htmlFor="weeks">
            How long it runs: <span className="design__value">{weeks} weeks</span>
          </label>
          <input id="weeks" type="range" min={8} max={104} step={1} value={weeks} onChange={(e) => onChange({ ...draft, durationDays: Number(e.target.value) * 7 })} />
          <span className="gr-field__help">Making it longer keeps every earlier week exactly the same.</span>
        </div>
      </section>

      <section className="design__section" aria-labelledby="featured-title">
        <h3 id="featured-title" className="t-title">Featured players (made up)</h3>
        <ul className="design__cards">
          {draft.players.map((p) => (
            <li key={p.id} className="design__card stack-sm">
              <div className="stack-xs">
                <span className="t-title">{p.label ?? p.id}</span>
                <span className="t-small muted">
                  {clubLabel.get(p.home)} · true skill starts at <span className="mono">{formatRating(p.skill.preset === "steady" ? p.skill.level : p.skill.preset === "keyframes" ? (p.skill.keyframes[0]?.[1] ?? 0) : p.skill.start)}</span>
                </span>
              </div>
              <ScaleSlider label="Volatility" stops={VOLATILITY_STOPS} value={p.volatility} onChange={(v) => setPlayer(p.id, { volatility: v })} />
              <ScaleSlider label="Appetite" stops={APPETITE_STOPS} value={p.appetite} onChange={(v) => setPlayer(p.id, { appetite: v })} />
              {p.startingRating.source !== "default" ? (
                <label className="gr-field" htmlFor={`claim-${p.id}`}>
                  <span className="gr-field__label">Starting rating they claim</span>
                  <input
                    id={`claim-${p.id}`}
                    className="gr-input mono"
                    type="number"
                    min={2}
                    max={8}
                    step={0.05}
                    value={p.startingRating.rating}
                    onChange={(e) => {
                      const rating = Number(e.target.value);
                      if (Number.isFinite(rating) && rating >= 2 && rating <= 8 && p.startingRating.source !== "default") {
                        setPlayer(p.id, { startingRating: { ...p.startingRating, rating: round(rating, 2) } });
                      }
                    }}
                  />
                  <span className="gr-field__help">Set it above or below their true skill to see how fast GlassRank corrects it.</span>
                </label>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="design__section" aria-labelledby="world-title">
        <div className="design__section-head">
          <h3 id="world-title" className="t-title">Clubs, events, and players</h3>
          <Tag>Editing soon</Tag>
        </div>
        <div className="grid-2">
          {draft.clubs.map((c) => (
            <div key={c.id} className="design__card stack-xs">
              <span className="t-title">{c.label ?? c.id}</span>
              <span className="t-small muted">{c.tier === "verified_host" ? "Verified club" : "Provisional club"}</span>
              <ul className="design__list">
                {draft.events
                  .filter((e) => e.club === c.id)
                  .map((e) => (
                    <li key={e.id}>
                      <strong>{e.label ?? e.id}</strong>{" "}
                      <span className="muted-2">
                        {e.label === rangeText(e.range) ? "" : `· ${rangeText(e.range)} `}· {e.schedule.kind === "weekly" ? WEEKDAYS[e.schedule.weekday] : `day ${e.schedule.day}`} · up to {e.capacity}
                        {(e.invites ?? []).length > 0 ? " · open to other clubs" : ""}
                      </span>
                    </li>
                  ))}
              </ul>
              <ul className="design__list">
                {draft.groups
                  .filter((g) => g.home === c.id)
                  .map((g) => (
                    <li key={g.id} className="muted-2">
                      <span className="mono">{g.count}</span> {(g.label ?? g.id).toLowerCase()}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
