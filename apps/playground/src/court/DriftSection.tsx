/**
 * Across the board: how far ratings ended from true skill, which way they
 * lean, how clubs compare, and the players furthest off.
 */
import { Button, formatDelta, formatRating } from "@glassrank/design";
import type { PlayerHistory } from "@glassrank/sim";
import { Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { BIN, CLOSE_GAP, OUTLIER_GAP, summarizeDrift, type Bin } from "./drift";
import { useWidth } from "./RatingChart";

const HEIGHT = 200;
const M = { top: 12, right: 12, bottom: 44, left: 36 };
const SHOWN_OUTLIERS = 8;

function Histogram({ bins }: { readonly bins: readonly Bin[] }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bins.map((b) => b.count));
  const lo = bins[0]?.from ?? -1;
  const hi = bins.at(-1)?.to ?? 1;
  const iw = Math.max(1, width - M.left - M.right);
  const ih = HEIGHT - M.top - M.bottom;
  const x = (v: number) => M.left + ((v - lo) / (hi - lo)) * iw;
  const y = (n: number) => M.top + ih - (n / max) * ih;
  const step = max > 40 ? 20 : max > 16 ? 10 : max > 8 ? 4 : 2;
  const yTicks: number[] = [];
  for (let n = 0; n <= max; n += step) yTicks.push(n);
  const xTicks: number[] = [];
  for (let v = Math.ceil(lo * 2) / 2; v <= hi + 1e-9; v += 0.5) xTicks.push(Math.round(v * 10) / 10);
  const b = hover === null ? null : bins[hover];
  const range = (bin: Bin) => `${formatDelta(bin.from)} to ${formatDelta(bin.to)}`;

  return (
    <figure className="chart">
      <figcaption className="chart__head">
        <span className="t-title">How far ratings ended from true skill</span>
        <ul className="chart__legend" aria-label="Legend">
          <li><span className="chart__key chart__key--bar" aria-hidden="true" />Players</li>
          <li><span className="chart__key chart__key--zone" aria-hidden="true" />Half a point or more off</li>
        </ul>
      </figcaption>
      <div className="chart__plot" ref={wrapRef}>
        <svg width={width} height={HEIGHT} role="img" aria-label="Histogram of the gap between each player's GlassRank rating and true skill at the end of the run. The same data is in the table below.">
          <rect className="drift__zone" x={M.left} y={M.top} width={Math.max(0, x(-OUTLIER_GAP) - M.left)} height={ih} />
          <rect className="drift__zone" x={x(OUTLIER_GAP)} y={M.top} width={Math.max(0, M.left + iw - x(OUTLIER_GAP))} height={ih} />
          {yTicks.map((n) => (
            <g key={n}>
              <line className="chart__grid" x1={M.left} x2={width - M.right} y1={y(n)} y2={y(n)} />
              <text className="chart__tick" x={M.left - 6} y={y(n)} textAnchor="end" dominantBaseline="middle">
                {n}
              </text>
            </g>
          ))}
          {bins.map((bin, i) => {
            const bx = x(bin.from) + 1;
            const bw = Math.max(1, x(bin.to) - x(bin.from) - 2);
            return (
              <g key={bin.from}>
                {bin.count > 0 ? <path className={`drift__bar${hover === i ? " is-active" : ""}`} d={`M${bx},${y(0)}V${y(bin.count) + 3}q0,-3 3,-3h${bw - 6}q3,0 3,3V${y(0)}Z`} /> : null}
                <rect className="chart__hit" x={x(bin.from)} y={M.top} width={x(bin.to) - x(bin.from)} height={ih} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} />
              </g>
            );
          })}
          <line className="drift__zero" x1={x(0)} x2={x(0)} y1={M.top} y2={M.top + ih} />
          {xTicks.map((v) => (
            <text key={v} className="chart__tick" x={x(v)} y={HEIGHT - 26} textAnchor="middle">
              {v === 0 ? "0" : formatDelta(v).replace(/0+$/, "").replace(/\.$/, "")}
            </text>
          ))}
          <text className="chart__tick" x={M.left} y={HEIGHT - 6}>
            ← Rated too low
          </text>
          <text className="chart__tick" x={width - M.right} y={HEIGHT - 6} textAnchor="end">
            Rated too high →
          </text>
        </svg>
        {b !== null && b !== undefined ? (
          <div className="chart__tip" style={{ left: Math.min(Math.max(x((b.from + b.to) / 2), 110), width - 110) }} role="status">
            <span className="t-small muted">Gap {range(b)}</span>
            <span className="chart__tip-row">
              <span>Players</span>
              <span className="mono">{b.count}</span>
            </span>
          </div>
        ) : null}
      </div>
      <details className="chart__table">
        <summary>Show as a table</summary>
        <div className="chart__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Gap (rating − true skill)</th>
                <th scope="col">Players</th>
              </tr>
            </thead>
            <tbody>
              {bins.map((bin) => (
                <tr key={bin.from}>
                  <td className="mono">{range(bin)}</td>
                  <td className="mono">{bin.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function DriftSection(props: {
  readonly players: readonly PlayerHistory[];
  readonly name: (p: PlayerHistory) => string;
  readonly club: (id: string) => string;
  readonly clubOrder: readonly string[];
  readonly onFollow: (id: string) => void;
}) {
  const drift = useMemo(() => summarizeDrift(props.players), [props.players]);
  const [showAll, setShowAll] = useState(false);
  const outliers = showAll ? drift.outliers : drift.outliers.slice(0, SHOWN_OUTLIERS);
  const clubs = [...drift.clubs].sort((a, b) => props.clubOrder.indexOf(a.club) - props.clubOrder.indexOf(b.club));
  const lean = Math.abs(drift.meanGap) < 0.02 ? "No overall lean" : drift.meanGap < 0 ? "Rated low overall" : "Rated high overall";
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  const tiles = [
    { value: formatRating(drift.medianAbsGap), label: "typical gap", help: "Half of players ended closer than this." },
    { value: pct(drift.closeShare), label: `within ±${CLOSE_GAP.toFixed(2)}`, help: "Ended within a quarter point of true skill." },
    { value: formatDelta(drift.meanGap), label: lean.toLowerCase(), help: "The average gap. Below zero means ratings run low." },
    { value: String(drift.outliers.length), label: "outliers", help: "Half a point or more off, about one bracket." },
  ];

  return (
    <section className="court__drift stack-sm" aria-labelledby="drift-title">
      <div className="stack-xs">
        <h2 id="drift-title" className="t-title">
          Across the board
        </h2>
        <p className="muted-2">
          How far every player's GlassRank rating ended from their true skill. Measured for {drift.measured} players after their last
          event; {drift.leftOut} still provisional or without a rated event are left out.
        </p>
      </div>

      <ul className="court__stats">
        {tiles.map((t) => (
          <li key={t.label} className="court__stat">
            <span className="court__stat-value">{t.value}</span>
            <span className="court__stat-label">{t.label}</span>
            <span className="t-small muted">{t.help}</span>
          </li>
        ))}
      </ul>

      <Histogram bins={drift.bins} />

      <div className="stack-xs">
        <h3 className="t-title">By club</h3>
        <p className="t-small muted">Clubs drifting in different directions is what players who travel between clubs help correct.</p>
        <div className="chart__scroll drift__table">
          <table>
            <thead>
              <tr>
                <th scope="col">Club</th>
                <th scope="col">Players</th>
                <th scope="col">Average gap</th>
                <th scope="col">Typical gap</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((c) => (
                <tr key={c.club}>
                  <td>{props.club(c.club)}</td>
                  <td className="mono">{c.players}</td>
                  <td className="mono">{formatDelta(c.meanGap)}</td>
                  <td className="mono">{formatRating(c.medianAbsGap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="stack-xs">
        <h3 className="t-title">Outliers</h3>
        {drift.outliers.length === 0 ? (
          <p className="muted-2">Every measured player ended within half a point of their true skill.</p>
        ) : (
          <>
            <p className="t-small muted">Players whose rating ended half a point or more from their true skill, furthest first. Follow one to see why.</p>
            <div className="chart__scroll drift__table drift__table--open">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Player</th>
                    <th scope="col">Rating</th>
                    <th scope="col">True skill</th>
                    <th scope="col">Gap</th>
                    <th scope="col">
                      <span className="sr-only">Follow</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {outliers.map((o) => (
                    <tr key={o.player.id}>
                      <td className="drift__who">
                        <span>{props.name(o.player)}</span>
                        <span className="t-small muted">{props.club(o.player.home)}</span>
                      </td>
                      <td className="mono">{formatRating(o.rating)}</td>
                      <td className="mono">{formatRating(o.trueSkill)}</td>
                      <td className="mono">{formatDelta(o.gap)}</td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => props.onFollow(o.player.id)} icon={<Eye className="gr-icon" width={16} height={16} strokeWidth={1.75} aria-hidden="true" />}>
                          Follow
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {drift.outliers.length > SHOWN_OUTLIERS ? (
              <div>
                <Button variant="ghost" size="sm" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? "Show fewer" : `Show all ${drift.outliers.length}`}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
      <p className="t-small muted">Gap is GlassRank rating minus true skill. True skill is only known in a simulation. Each histogram bar is {BIN.toFixed(1)} wide.</p>
    </section>
  );
}
