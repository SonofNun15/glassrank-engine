/**
 * Why a followed player's rating ended where it did: their settings, where
 * and against whom they played, how they played against their true skill,
 * and whether the pool they played in was rated too low or too high. Then
 * any single event, opened from the chart, with GlassRank's own receipt.
 */
import { Button, DeltaChip, ReceiptCard, Tag, formatRating } from "@glassrank/design";
import type { CourtMate, FollowedEventReport, PlayerReport } from "@glassrank/sim";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { weekOf } from "./RatingChart";
import { APPETITE_STOPS, ATTENDANCE_STOPS, TRAVEL_STOPS, VOLATILITY_STOPS, nearestStop, positionOf, type Stop } from "./sliders";

export interface Namer {
  readonly player: (id: string) => string;
  readonly event: (seriesId: string) => string;
}

/** A pool or player this far off true skill on average is worth calling out. */
const NOTABLE = 0.15;
const small = { className: "gr-icon", width: 16, height: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const label = (stops: readonly Stop[], v: number) => nearestStop(stops, positionOf(stops, v)).label;
const off = (x: number, above: string, below: string) => (Math.abs(x) < 0.02 ? null : `${Math.abs(x).toFixed(2)} ${x > 0 ? above : below}`);

function startedFrom(p: PlayerReport["profile"]["startingRating"]): string {
  const r = p.rating === null ? "" : formatRating(p.rating).slice(0, 4);
  switch (p.source) {
    case "self":
      return `claimed ${r}`;
    case "host":
      return `club assigned ${r}`;
    case "external_claimed":
      return `brought ${r} from another system`;
    case "policy_default":
      return "default rating";
  }
}

export function WhyPanel({ report, namer }: { readonly report: PlayerReport; readonly namer: Namer }) {
  const s = report.summary;
  const p = report.profile;
  if (s.events === 0) return null;
  const [top, ...rest] = s.leagues;
  const usual = [...s.courts].sort((a, b) => b.events - a.events)[0];
  const maxCourts = Math.max(...report.events.map((e) => e.courts));
  const pct = s.ratedGamesPlayed === 0 ? 0 : Math.round((100 * s.ratedGamesWon) / s.ratedGamesPlayed);
  const diff = s.ratedGamesWon - s.expectedGamesWon;
  const versus = Math.abs(diff) <= 1 ? "about what the ratings expected" : diff > 0 ? "more than the ratings expected" : "fewer than the ratings expected";
  const poolNotable = Math.abs(s.poolGap) >= NOTABLE;

  const facts: { readonly key: string; readonly title: string; readonly text: string; readonly highlight?: boolean }[] = [
    {
      key: "where",
      title: "Where they played",
      text:
        `${top?.events} of ${s.events} events at ${namer.event(top?.series ?? "")}` +
        (rest.length > 0 ? `; the rest at ${rest.map((l) => namer.event(l.series)).join(", ")}` : "") +
        `. Usually on court ${usual?.court} of up to ${maxCourts} (court 1 is the top court).`,
    },
    {
      key: "results",
      title: "Results",
      text: `Won ${s.ratedGamesWon} of ${s.ratedGamesPlayed} rated games (${pct}%): ${versus}, which was about ${s.expectedGamesWon.toFixed(1)}.`,
    },
    {
      key: "pool",
      title: "The players around them",
      text:
        (off(s.poolGap, "above", "below") === null
          ? "The players they shared courts with were rated about right for their true skill."
          : `The players they shared courts with were rated ${off(s.poolGap, "above", "below")} their true skill on average.`) +
        (s.poolGap <= -NOTABLE
          ? " This pool is rated low, so results against it earn less than they should."
          : s.poolGap >= NOTABLE
            ? " This pool is rated high, so results against it cost less than they should."
            : ""),
      highlight: poolNotable,
    },
    {
      key: "edge",
      title: "How strong they really were",
      text:
        off(s.edge, "above", "below") === null
          ? "Their true skill matched the players they shared courts with."
          : `Their true skill was ${off(s.edge, "above", "below")} the players they shared courts with.`,
    },
    {
      key: "form",
      title: "How they played",
      text:
        off(s.form, "above", "below") === null
          ? "On average they played right at their true skill."
          : `On average they played ${off(s.form, "above", "below")} their true skill.`,
    },
    {
      key: "own",
      title: "Their own rating",
      text:
        off(s.ownGap, "above", "below") === null
          ? "Going into events, their rating was about right on average."
          : `Going into events, their rating was ${off(s.ownGap, "above", "below")} their true skill on average.`,
    },
  ];

  return (
    <section className="why stack-sm" aria-label="Why their rating ended here">
      <div className="stack-xs">
        <h3 className="t-title">Why their rating ended here</h3>
        <p className="t-small muted">What GlassRank saw, next to what only a simulation knows: true skill and how they really played.</p>
      </div>
      <ul className="why__profile" aria-label="Player settings">
        <li><Tag>Volatility: {label(VOLATILITY_STOPS, p.volatility)}</Tag></li>
        <li><Tag>Appetite: {label(APPETITE_STOPS, p.appetite)}</Tag></li>
        <li><Tag>Travel: {label(TRAVEL_STOPS, p.travel)}</Tag></li>
        <li><Tag>Plays: {label(ATTENDANCE_STOPS, p.attendance).toLowerCase()}</Tag></li>
        <li><Tag>Started: {startedFrom(p.startingRating)}</Tag></li>
      </ul>
      <dl className="why__facts">
        {facts.map((f) => (
          <div key={f.key} className={`why__fact${f.highlight ? " is-highlight" : ""}`}>
            <dt>
              {f.title}
              {f.highlight ? <Tag tone="highlight">Worth a look</Tag> : null}
            </dt>
            <dd>{f.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Person({ mate, namer }: { readonly mate: CourtMate; readonly namer: Namer }) {
  return (
    <span className="why__person">
      <span>{namer.player(mate.id)}</span>
      <span className="t-small muted">
        rated <span className="mono">{formatRating(mate.rating)}</span> · true <span className="mono">{formatRating(mate.trueSkill)}</span>
      </span>
    </span>
  );
}

export function EventDetail(props: {
  readonly report: PlayerReport;
  readonly index: number | null;
  readonly onIndex: (i: number | null) => void;
  readonly namer: Namer;
}) {
  const { report, index, onIndex, namer } = props;
  const selectId = useId();
  const events = report.events;
  const e: FollowedEventReport | undefined = index === null ? undefined : events[index];
  const biggest = events.reduce((best, x, i) => (Math.abs(x.rating - x.ratingBefore) > Math.abs((events[best]?.rating ?? 0) - (events[best]?.ratingBefore ?? 0)) ? i : best), 0);

  return (
    <section className="why stack-sm" aria-label="Event detail">
      <div className="why__event-head">
        <div className="stack-xs">
          <h3 className="t-title">Event by event</h3>
          <p className="t-small muted">Click a point on the chart, or pick an event here.</p>
        </div>
        <div className="why__nav">
          <Button variant="ghost" size="sm" disabled={index === null || index === 0} onClick={() => onIndex((index ?? 1) - 1)} icon={<ChevronLeft {...small} />}>
            Previous
          </Button>
          <label className="sr-only" htmlFor={selectId}>
            Event
          </label>
          <select id={selectId} className="gr-input why__select" value={index ?? ""} onChange={(x) => onIndex(x.target.value === "" ? null : Number(x.target.value))}>
            <option value="">Choose an event…</option>
            {events.map((x, i) => (
              <option key={x.eventId} value={i}>
                Week {weekOf(x.day)} · {namer.event(x.series)}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" disabled={index === null || index >= events.length - 1} onClick={() => onIndex((index ?? -1) + 1)} icon={<ChevronRight {...small} />}>
            Next
          </Button>
        </div>
      </div>

      {e === undefined ? (
        <div>
          <Button variant="secondary" size="sm" onClick={() => onIndex(biggest)}>
            Start with their biggest rating change
          </Button>
        </div>
      ) : (
        <div className="stack-sm why__event">
          <div className="why__event-title">
            <span className="t-body">
              <strong>Week {weekOf(e.day)}</strong> · {namer.event(e.series)} · court {e.court} of {e.courts}
            </span>
            {e.rated ? <DeltaChip value={e.rating - e.ratingBefore} /> : <Tag>Not rated</Tag>}
          </div>
          <p className="t-small muted">
            Going in: rated <span className="mono">{formatRating(e.ratingBefore)}</span>, true skill <span className="mono">{formatRating(e.trueSkill)}</span>.{" "}
            {off(e.nightForm, "above", "below") === null ? "They played at their true level that night." : `That night they played ${off(e.nightForm, "above", "below")} their true skill.`}
          </p>
          <div className="chart__scroll drift__table drift__table--open">
            <table>
              <thead>
                <tr>
                  <th scope="col">Partner</th>
                  <th scope="col">Opponents</th>
                  <th scope="col">Score</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {e.matches.map((m) => (
                  <tr key={m.matchId}>
                    <td className="why__cell">
                      {m.partners.map((x) => (
                        <Person key={x.id} mate={x} namer={namer} />
                      ))}
                    </td>
                    <td className="why__cell">
                      {m.opponents.map((x) => (
                        <Person key={x.id} mate={x} namer={namer} />
                      ))}
                    </td>
                    <td className="mono">{m.games.map(([a, b]) => `${a}–${b}`).join(", ")}</td>
                    <td>{m.won ? "Won" : "Lost"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {e.explanation !== null ? (
            <ReceiptCard
              eyebrow={`GlassRank's receipt · week ${weekOf(e.day)}`}
              delta={e.rating - e.ratingBefore}
              explanation={e.explanation}
              eventLabel={namer.event(e.series)}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
