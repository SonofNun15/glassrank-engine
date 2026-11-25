/**
 * One player's GlassRank rating against their true skill over a simulated
 * run. The rating is a step line (it holds between events); true skill is a
 * dashed line, labeled as known only in simulations. Hover or use the arrow
 * keys for a readout; the same data is available as a table.
 */
import { DeltaChip, formatDelta, formatRating } from "@glassrank/design";
import type { RatingPoint } from "@glassrank/sim";
import { type KeyboardEvent, type PointerEvent, useLayoutEffect, useMemo, useRef, useState } from "react";

const HEIGHT = 280;
const M = { top: 12, right: 16, bottom: 32, left: 48 };

export const weekOf = (day: number) => Math.floor(day / 7) + 1;

/** Narrowest a chart draws; small phones leave about 250 px inside a panel. */
const MIN_WIDTH = 240;

/**
 * The width of the element `ref` points at, measured before the first paint
 * (so a chart never flashes at `fallback` width) and kept current as it resizes.
 */
export function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const measure = (w: number) => {
      if (w > 0) setWidth(Math.max(MIN_WIDTH, Math.round(w)));
    };
    measure(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry !== undefined) measure(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function RatingChart(props: {
  readonly points: readonly RatingPoint[];
  readonly durationDays: number;
  readonly eventLabel: (seriesId: string) => string;
  readonly title: string;
  /** Whose chart this is, for screen readers. */
  readonly subject: string;
  /** Called with a point's index when the visitor clicks it (or presses Enter on it). */
  readonly onPick?: (index: number) => void;
  readonly picked?: number | null;
}) {
  const { points, durationDays, eventLabel, title, subject, onPick, picked = null } = props;
  const [wrapRef, width] = useWidth<HTMLDivElement>(720);
  const [active, setActive] = useState<number | null>(null);

  const geo = useMemo(() => {
    const values = points.flatMap((p) => [p.rating, p.ratingBefore, p.trueSkill, ...(p.provisional ? [p.provisional.low, p.provisional.high] : [])]);
    const lo = values.length ? Math.min(...values) : 3;
    const hi = values.length ? Math.max(...values) : 4;
    const step = hi - lo > 2 ? 0.5 : 0.25;
    const y0 = Math.floor((lo - 0.05) / step) * step;
    const y1 = Math.ceil((hi + 0.05) / step) * step;
    const iw = width - M.left - M.right;
    const ih = HEIGHT - M.top - M.bottom;
    const x = (day: number) => M.left + (day / Math.max(1, durationDays)) * iw;
    const y = (v: number) => M.top + (1 - (v - y0) / (y1 - y0)) * ih;
    const yTicks: number[] = [];
    for (let v = y0; v <= y1 + 1e-9; v += step) yTicks.push(Math.round(v * 100) / 100);
    const weeks = Math.ceil(durationDays / 7);
    const every = weeks > 80 ? 26 : 13;
    const xTicks: number[] = [];
    for (let w = 0; w < weeks; w += every) xTicks.push(w * 7);

    let rating = "";
    let truth = "";
    points.forEach((p, i) => {
      rating += i === 0 ? `M${x(p.day)},${y(p.ratingBefore)}V${y(p.rating)}` : `H${x(p.day)}V${y(p.rating)}`;
      truth += `${i === 0 ? "M" : "L"}${x(p.day)},${y(p.trueSkill)}`;
    });
    const last = points.at(-1);
    if (last !== undefined) rating += `H${x(durationDays)}`;

    // Provisional band: from the first event until the range ends.
    const prov = points.filter((p) => p.provisional !== null);
    let band = "";
    if (prov.length > 0) {
      const top = prov.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day)},${y(p.provisional!.high)}`).join("");
      const bottom = [...prov].reverse().map((p) => `L${x(p.day)},${y(p.provisional!.low)}`).join("");
      band = `${top}${bottom}Z`;
    }
    return { x, y, yTicks, xTicks, rating, truth, band, iw, ih };
  }, [points, durationDays, width]);

  const nearest = (day: number) => {
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.day - day) < Math.abs((points[best] as RatingPoint).day - day)) best = i;
    });
    return best;
  };
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const day = ((e.clientX - box.left) / box.width) * durationDays;
    setActive(nearest(day));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const d = e.key === "ArrowRight" ? 1 : -1;
      setActive((a) => Math.min(points.length - 1, Math.max(0, (a ?? (d > 0 ? -1 : points.length)) + d)));
    } else if (e.key === "Enter" && active !== null) onPick?.(active);
    else if (e.key === "Escape") setActive(null);
  };

  const pt = active === null ? null : (points[active] ?? null);
  const tipLeft = pt === null ? 0 : geo.x(pt.day);

  return (
    <figure className="chart">
      <figcaption className="chart__head">
        <span className="t-title">{title}</span>
        <ul className="chart__legend" aria-label="Legend">
          <li><span className="chart__key chart__key--rating" aria-hidden="true" />GlassRank rating</li>
          <li><span className="chart__key chart__key--truth" aria-hidden="true" />True skill (simulation only)</li>
          {geo.band !== "" ? <li><span className="chart__key chart__key--range" aria-hidden="true" />Provisional range</li> : null}
        </ul>
      </figcaption>

      <div className="chart__plot" ref={wrapRef}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${subject}: GlassRank rating and true skill by week. Use the left and right arrow keys to step through events${onPick ? ", and Enter to open one" : ""}.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {geo.yTicks.map((v) => (
            <g key={v}>
              <line className="chart__grid" x1={M.left} x2={width - M.right} y1={geo.y(v)} y2={geo.y(v)} />
              <text className="chart__tick" x={M.left - 8} y={geo.y(v)} textAnchor="end" dominantBaseline="middle">
                {v.toFixed(2)}
              </text>
            </g>
          ))}
          {geo.xTicks.map((d) => (
            <text key={d} className="chart__tick" x={geo.x(d)} y={HEIGHT - 10} textAnchor="middle">
              Week {weekOf(d)}
            </text>
          ))}
          {geo.band !== "" ? <path className="chart__band" d={geo.band} /> : null}
          <path className="chart__truth" d={geo.truth} />
          <path className="chart__rating" d={geo.rating} />
          {picked !== null && points[picked] !== undefined ? (
            <circle className="chart__dot chart__dot--picked" cx={geo.x((points[picked] as RatingPoint).day)} cy={geo.y((points[picked] as RatingPoint).rating)} r={6} />
          ) : null}
          {pt !== null ? (
            <g>
              <line className="chart__cross" x1={tipLeft} x2={tipLeft} y1={M.top} y2={HEIGHT - M.bottom} />
              <circle className="chart__dot chart__dot--truth" cx={tipLeft} cy={geo.y(pt.trueSkill)} r={4} />
              <circle className="chart__dot chart__dot--rating" cx={tipLeft} cy={geo.y(pt.rating)} r={4} />
            </g>
          ) : null}
          <rect
            className="chart__hit"
            x={M.left}
            y={M.top}
            width={Math.max(0, geo.iw)}
            height={Math.max(0, geo.ih)}
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
            onClick={(e) => {
              if (onPick === undefined) return;
              const box = e.currentTarget.getBoundingClientRect();
              onPick(nearest(((e.clientX - box.left) / box.width) * durationDays));
            }}
            style={onPick ? { cursor: "pointer" } : undefined}
          />
        </svg>
        {pt !== null ? (
          <div className="chart__tip" style={{ left: Math.min(Math.max(tipLeft, 110), width - 110) }} role="status">
            <span className="t-small muted">
              Week {weekOf(pt.day)} · {eventLabel(pt.series)}
            </span>
            <span className="chart__tip-row">
              <span>Rating</span>
              <span className="mono">{formatRating(pt.rating)}</span>
              <DeltaChip value={pt.rating - pt.ratingBefore} />
            </span>
            <span className="chart__tip-row">
              <span>True skill</span>
              <span className="mono">{formatRating(pt.trueSkill)}</span>
            </span>
            {onPick ? <span className="t-small muted">Click to see this event</span> : null}
          </div>
        ) : null}
      </div>

      <details className="chart__table">
        <summary>Show as a table</summary>
        <div className="chart__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Week</th>
                <th scope="col">Event</th>
                <th scope="col">Rating</th>
                <th scope="col">Change</th>
                <th scope="col">True skill</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.eventId}>
                  <td className="mono">{weekOf(p.day)}</td>
                  <td>{eventLabel(p.series)}</td>
                  <td className="mono">{formatRating(p.rating)}</td>
                  <td className="mono">{formatDelta(p.rating - p.ratingBefore)}</td>
                  <td className="mono">{formatRating(p.trueSkill)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
