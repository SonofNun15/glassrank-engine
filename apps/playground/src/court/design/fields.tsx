/** Form controls for Design mode, built on the design system's field styles. */
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { nearestStop, positionOf, valueAt, type Stop } from "../sliders";

const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;

/** A plain-language slider: visitors see labels; the recipe stores the number. */
export function ScaleSlider(props: { readonly label: string; readonly stops: readonly Stop[]; readonly value: number; readonly onChange: (v: number) => void }) {
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

/**
 * A number input that keeps what the visitor types until it's a valid value.
 * `scale` converts stored units to shown units (7 shows days as weeks).
 */
function NumberInput(props: {
  readonly id?: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly scale?: number;
  readonly label?: string;
  readonly onChange: (v: number) => void;
}) {
  const scale = props.scale ?? 1;
  // Weeks and other scaled units show one decimal; raw values keep three.
  const shown = round(props.value / scale, scale === 1 ? 3 : 1);
  const [text, setText] = useState(String(shown));
  useEffect(() => setText(String(shown)), [shown]);
  const invalid = (() => {
    const n = Number(text);
    return text.trim() === "" || !Number.isFinite(n) || n < props.min || n > props.max;
  })();
  return (
    <input
      id={props.id}
      className="gr-input mono design__number"
      type="number"
      inputMode="decimal"
      min={props.min}
      max={props.max}
      step={props.step}
      value={text}
      aria-label={props.label}
      aria-invalid={invalid}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= props.min && n <= props.max) props.onChange(round(n * scale, 4));
      }}
      onBlur={() => setText(String(shown))}
    />
  );
}

export function NumberField(props: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly scale?: number;
  readonly help?: ReactNode;
  readonly onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="gr-field">
      <label className="gr-field__label" htmlFor={id}>
        {props.label}
      </label>
      <NumberInput id={id} {...props} />
      {props.help !== undefined ? <span className="gr-field__help">{props.help}</span> : null}
    </div>
  );
}

/** A [low, high] range as two numbers. */
export function RangeField(props: {
  readonly label: string;
  readonly value: readonly [number, number];
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly scale?: number;
  readonly help?: ReactNode;
  readonly onChange: (v: [number, number]) => void;
}) {
  const [lo, hi] = props.value;
  const common = { min: props.min, max: props.max, step: props.step, ...(props.scale === undefined ? {} : { scale: props.scale }) };
  return (
    <fieldset className="gr-field design__range">
      <legend className="gr-field__label">{props.label}</legend>
      <div className="design__range-inputs">
        <NumberInput {...common} label={`${props.label}, from`} value={lo} onChange={(v) => props.onChange([Math.min(v, hi), Math.max(v, hi)])} />
        <span className="muted" aria-hidden="true">to</span>
        <NumberInput {...common} label={`${props.label}, to`} value={hi} onChange={(v) => props.onChange([Math.min(lo, v), Math.max(lo, v)])} />
      </div>
      {props.help !== undefined ? <span className="gr-field__help">{props.help}</span> : null}
    </fieldset>
  );
}

export function SelectField<T extends string>(props: {
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly help?: ReactNode;
  readonly onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="gr-field">
      <label className="gr-field__label" htmlFor={id}>
        {props.label}
      </label>
      <select id={id} className="gr-input" value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {props.help !== undefined ? <span className="gr-field__help">{props.help}</span> : null}
    </div>
  );
}

export function TextField(props: { readonly label: string; readonly value: string; readonly maxLength: number; readonly help?: ReactNode; readonly onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="gr-field">
      <label className="gr-field__label" htmlFor={id}>
        {props.label}
      </label>
      <input id={id} className="gr-input" type="text" maxLength={props.maxLength} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      {props.help !== undefined ? <span className="gr-field__help">{props.help}</span> : null}
    </div>
  );
}

/** A collapsible "More settings" area. */
export function More({ children, label = "More settings" }: { readonly children: ReactNode; readonly label?: string }) {
  return (
    <details className="design__more">
      <summary>{label}</summary>
      <div className="stack-sm design__more-body">{children}</div>
    </details>
  );
}

/**
 * A card that collapses to one summary line. The summary holds no buttons
 * (interactive content inside <summary> is not allowed); actions go in the body.
 */
export function CardDisclosure(props: { readonly title: string; readonly meta: string; readonly defaultOpen?: boolean; readonly children: ReactNode }) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <details className="design__card design__disclosure" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="stack-xs">
          <span className="t-title">{props.title}</span>
          <span className="t-small muted">{props.meta}</span>
        </span>
        <ChevronDown className="gr-icon design__chevron" width={20} height={20} strokeWidth={1.75} aria-hidden="true" />
      </summary>
      <div className="stack-sm design__disclosure-body">{open ? props.children : null}</div>
    </details>
  );
}

/** A smaller collapsible row inside a card (events, groups of players). */
export function RowDisclosure(props: { readonly title: ReactNode; readonly meta: string; readonly defaultOpen?: boolean; readonly children: ReactNode }) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <details className="design__row" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="stack-xs">
          <span className="t-body">{props.title}</span>
          <span className="t-small muted">{props.meta}</span>
        </span>
        <ChevronDown className="gr-icon design__chevron" width={20} height={20} strokeWidth={1.75} aria-hidden="true" />
      </summary>
      <div className="stack-sm design__row-body">{open ? props.children : null}</div>
    </details>
  );
}

/** A number that may be left empty (empty = no limit). Keeps what the visitor types until it's valid. */
export function OptionalNumberField(props: {
  readonly label: string;
  readonly value: number | undefined;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly placeholder: string;
  readonly help?: ReactNode;
  readonly onChange: (v: number | undefined) => void;
}) {
  const id = useId();
  const shown = props.value === undefined ? "" : String(props.value);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const n = Number(text);
  const invalid = text.trim() !== "" && (!Number.isFinite(n) || n < props.min || n > props.max);
  return (
    <div className="gr-field">
      <label className="gr-field__label" htmlFor={id}>
        {props.label}
      </label>
      <input
        id={id}
        className="gr-input mono design__number"
        type="number"
        inputMode="decimal"
        min={props.min}
        max={props.max}
        step={props.step}
        placeholder={props.placeholder}
        value={text}
        aria-invalid={invalid}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (t.trim() === "") props.onChange(undefined);
          else {
            const v = Number(t);
            if (Number.isFinite(v) && v >= props.min && v <= props.max) props.onChange(round(v, 2));
          }
        }}
        onBlur={() => setText(shown)}
      />
      {props.help !== undefined ? <span className="gr-field__help">{props.help}</span> : null}
    </div>
  );
}
