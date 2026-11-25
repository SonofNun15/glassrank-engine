/**
 * True skill over time as points on a graph. Editable: click empty space to
 * add a point, drag a point to move it, select one and press Delete (or the
 * button) to remove it; arrow keys move the selected point. The table below
 * edits the same points by number. Read-only when `onChange` is absent.
 */
import { Button } from "@glassrank/design";
import { Trash2 } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from "react";
import { useWidth, weekOf } from "../RatingChart";

type Keyframe = readonly [number, number];
const HEIGHT = 200;
const M = { top: 12, right: 16, bottom: 28, left: 44 };
const MAX_POINTS = 24;
const clampSkill = (v: number) => Math.min(8, Math.max(2, Math.round(v * 20) / 20));

export function KeyframeEditor(props: {
  readonly keyframes: readonly Keyframe[];
  readonly durationDays: number;
  readonly onChange?: (next: [number, number][]) => void;
  readonly label: string;
}) {
  const { keyframes, durationDays, onChange } = props;
  const editable = onChange !== undefined;
  const [wrapRef, width] = useWidth<HTMLDivElement>(520);
  const [selected, setSelected] = useState<number | null>(null);
  const drag = useRef<{ index: number; domain: readonly [number, number] } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const domain = useMemo((): readonly [number, number] => {
    if (drag.current !== null) return drag.current.domain;
    const values = keyframes.map(([, s]) => s);
    const lo = Math.max(2, Math.floor((Math.min(...values) - 0.5) * 2) / 2);
    const hi = Math.min(8, Math.ceil((Math.max(...values) + 0.5) * 2) / 2);
    return [lo, Math.max(hi, lo + 1)];
  }, [keyframes]);

  const iw = Math.max(1, width - M.left - M.right);
  const ih = HEIGHT - M.top - M.bottom;
  const x = (day: number) => M.left + (day / Math.max(1, durationDays)) * iw;
  const y = (v: number) => M.top + (1 - (v - domain[0]) / (domain[1] - domain[0])) * ih;
  const toDay = (px: number) => ((px - M.left) / iw) * durationDays;
  const toSkill = (py: number) => domain[0] + (1 - (py - M.top) / ih) * (domain[1] - domain[0]);

  const emit = (next: Keyframe[]) => onChange?.(next.map(([d, s]) => [d, s]));
  /** Day for point `i`, snapped to a week and kept between its neighbours. */
  const placeDay = (i: number, day: number, list: readonly Keyframe[]) => {
    const lo = i === 0 ? 0 : (list[i - 1] as Keyframe)[0] + 1;
    const hi = i === list.length - 1 ? durationDays : (list[i + 1] as Keyframe)[0] - 1;
    return Math.min(hi, Math.max(lo, Math.round(day / 7) * 7));
  };
  const move = (i: number, day: number, skill: number) => {
    const next = [...keyframes];
    next[i] = [placeDay(i, day, keyframes), clampSkill(skill)];
    emit(next);
  };
  const remove = (i: number) => {
    if (keyframes.length <= 1) return;
    emit(keyframes.filter((_, j) => j !== i));
    setSelected(null);
  };
  const local = (e: PointerEvent) => {
    const box = (svgRef.current as SVGSVGElement).getBoundingClientRect();
    return { px: e.clientX - box.left, py: e.clientY - box.top };
  };

  const onBackground = (e: PointerEvent<SVGRectElement>) => {
    if (!editable || keyframes.length >= MAX_POINTS) return;
    const { px, py } = local(e);
    const day = Math.min(durationDays, Math.max(0, Math.round(toDay(px) / 7) * 7));
    if (keyframes.some(([d]) => d === day)) return;
    const next = [...keyframes, [day, clampSkill(toSkill(py))] as Keyframe].sort((a, b) => a[0] - b[0]);
    emit(next);
    setSelected(next.findIndex(([d]) => d === day));
  };
  const onPointDown = (i: number) => (e: PointerEvent<SVGCircleElement>) => {
    if (!editable) return;
    e.stopPropagation();
    setSelected(i);
    drag.current = { index: i, domain };
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (drag.current === null) return;
    const { px, py } = local(e);
    move(drag.current.index, toDay(px), toSkill(py));
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onPointKey = (i: number) => (e: KeyboardEvent<SVGCircleElement>) => {
    const [d, s] = keyframes[i] as Keyframe;
    const big = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowUp") move(i, d, s + 0.05 * big);
    else if (e.key === "ArrowDown") move(i, d, s - 0.05 * big);
    else if (e.key === "ArrowRight") move(i, d + 7 * big, s);
    else if (e.key === "ArrowLeft") move(i, d - 7 * big, s);
    else if (e.key === "Delete" || e.key === "Backspace") remove(i);
    else return;
    e.preventDefault();
  };

  const ticks: number[] = [];
  for (let v = Math.ceil(domain[0] * 2) / 2; v <= domain[1] + 1e-9; v += 0.5) ticks.push(v);
  const weeks = Math.ceil(durationDays / 7);
  const every = weeks > 80 ? 26 : 13;
  const xTicks: number[] = [];
  for (let w = 0; w < weeks; w += every) xTicks.push(w * 7);
  const path = keyframes.map(([d, s], i) => `${i === 0 ? "M" : "L"}${x(d)},${y(s)}`).join("") + (keyframes.length > 0 ? `H${x(durationDays)}` : "");
  const lead = keyframes[0] !== undefined && keyframes[0][0] > 0 ? `M${x(0)},${y(keyframes[0][1])}H${x(keyframes[0][0])}` : "";

  return (
    <div className="keys">
      <div className="keys__plot" ref={wrapRef}>
        <svg
          ref={svgRef}
          width={width}
          height={HEIGHT}
          role="group"
          aria-label={`${props.label}: true skill over time${editable ? ". Click to add a point; select a point and use the arrow keys to move it or Delete to remove it." : ""}`}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line className="chart__grid" x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} />
              <text className="chart__tick" x={M.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          {xTicks.map((d) => (
            <text key={d} className="chart__tick" x={x(d)} y={HEIGHT - 8} textAnchor="middle">
              Week {weekOf(d)}
            </text>
          ))}
          <rect className={editable ? "keys__hit" : "chart__hit"} x={M.left} y={M.top} width={iw} height={ih} onPointerDown={onBackground} />
          <path className="chart__truth" d={lead + path} />
          {editable
            ? keyframes.map(([d, s], i) => (
                <circle
                  key={`${i}-${d}`}
                  className={`keys__point${selected === i ? " is-selected" : ""}`}
                  cx={x(d)}
                  cy={y(s)}
                  r={selected === i ? 7 : 6}
                  tabIndex={0}
                  role="button"
                  aria-label={`Point ${i + 1}: week ${weekOf(d)}, skill ${s.toFixed(2)}`}
                  onPointerDown={onPointDown(i)}
                  onFocus={() => setSelected(i)}
                  onKeyDown={onPointKey(i)}
                />
              ))
            : null}
        </svg>
      </div>
      {editable ? (
        <div className="keys__bar">
          <span className="t-small muted">
            {keyframes.length} of {MAX_POINTS} points.{" "}
            {selected !== null && keyframes[selected] !== undefined
              ? `Selected: week ${weekOf(keyframes[selected][0])}, skill ${keyframes[selected][1].toFixed(2)}.`
              : "Click the graph to add a point; drag points to move them."}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={selected === null || keyframes.length <= 1}
            onClick={() => selected !== null && remove(selected)}
            icon={<Trash2 className="gr-icon" width={16} height={16} strokeWidth={1.75} aria-hidden="true" />}
          >
            Remove point
          </Button>
        </div>
      ) : null}
      {editable ? (
        <details className="chart__table">
          <summary>Edit points as a table</summary>
          <div className="chart__scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Week</th>
                  <th scope="col">True skill</th>
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {keyframes.map(([d, s], i) => (
                  <tr key={`${i}-${d}-${s}`}>
                    <td>
                      <input
                        className="gr-input mono design__number"
                        type="number"
                        min={1}
                        max={weeks + 1}
                        step={1}
                        defaultValue={weekOf(d)}
                        aria-label={`Point ${i + 1} week`}
                        onBlur={(e) => move(i, (Number(e.target.value) - 1) * 7, s)}
                      />
                    </td>
                    <td>
                      <input
                        className="gr-input mono design__number"
                        type="number"
                        min={2}
                        max={8}
                        step={0.05}
                        defaultValue={s}
                        aria-label={`Point ${i + 1} skill`}
                        onBlur={(e) => move(i, d, Number(e.target.value))}
                      />
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" disabled={keyframes.length <= 1} onClick={() => remove(i)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
