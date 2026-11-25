/** When an event runs: day, how often, and the weeks it starts and ends. Shared by leagues and tournaments. */
import type { EventSeries } from "@glassrank/sim";
import { NumberField, SelectField } from "./fields";

type Schedule = EventSeries["schedule"];
type Often = "1" | "2" | "4" | "13" | "once";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Set an optional field, or remove it when `value` is undefined. */
function withField<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): T {
  const next = { ...obj };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

/** "Tuesdays", "every other Saturday", "every 4 weeks on Saturday", or "once, week 12". */
export function describeSchedule(s: Schedule): string {
  if (s.kind === "once") return `once, week ${Math.floor(s.day / 7) + 1}`;
  const every = s.everyWeeks ?? 1;
  const day = WEEKDAYS[s.weekday] as string;
  if (every === 1) return `${day}s`;
  if (every === 2) return `every other ${day}`;
  if (every === 4) return `monthly on ${day}s`;
  return `every ${every} weeks on ${day}s`;
}

/** Day, how often, and (for one-off events) which week. */
export function ScheduleFields(props: { readonly schedule: Schedule; readonly durationDays: number; readonly onChange: (s: Schedule) => void }) {
  const s = props.schedule;
  const weeks = Math.ceil(props.durationDays / 7);
  const weekday = s.kind === "weekly" ? s.weekday : s.day % 7;
  const often: Often = s.kind === "once" ? "once" : (String(s.everyWeeks ?? 1) as Often);

  const change = (next: { often?: Often; weekday?: number; week?: number }) => {
    const o = next.often ?? often;
    const d = next.weekday ?? weekday;
    if (o === "once") {
      const week = next.week ?? (s.kind === "once" ? Math.floor(s.day / 7) + 1 : 1);
      props.onChange({ kind: "once", day: Math.min(props.durationDays - 1, (week - 1) * 7 + d), ...(s.hour === undefined ? {} : { hour: s.hour }) });
      return;
    }
    const base: Schedule = s.kind === "weekly" ? { ...s, weekday: d } : { kind: "weekly", weekday: d, ...(s.hour === undefined ? {} : { hour: s.hour }) };
    const every = Number(o);
    props.onChange(every === 1 ? withField(base, "everyWeeks", undefined) : { ...base, everyWeeks: every });
  };

  return (
    <>
      <SelectField label="Day" value={String(weekday)} options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} onChange={(d) => change({ weekday: Number(d) })} />
      <SelectField<Often>
        label="How often"
        value={often}
        options={[
          { value: "1", label: "Every week" },
          { value: "2", label: "Every other week" },
          { value: "4", label: "Monthly (every four weeks)" },
          { value: "13", label: "Every 13 weeks (quarterly)" },
          { value: "once", label: "Once" },
        ]}
        onChange={(o) => change({ often: o })}
      />
      {s.kind === "once" ? (
        <NumberField label="In week" value={Math.floor(s.day / 7) + 1} min={1} max={weeks} step={1} onChange={(week) => change({ week: Math.round(week) })} />
      ) : null}
    </>
  );
}

/** The weeks a repeating event starts and ends. */
export function ExtentFields(props: { readonly schedule: Schedule; readonly durationDays: number; readonly onChange: (s: Schedule) => void }) {
  const s = props.schedule;
  if (s.kind !== "weekly") return null;
  const weeks = Math.ceil(props.durationDays / 7);
  return (
    <>
      <NumberField
        label="Starts in week"
        value={(s.firstWeek ?? 0) + 1}
        min={1}
        max={weeks}
        step={1}
        onChange={(w) => props.onChange(withField(s, "firstWeek", w <= 1 ? undefined : Math.round(w) - 1))}
      />
      <NumberField
        label="Ends after week"
        value={(s.lastWeek ?? weeks - 1) + 1}
        min={1}
        max={weeks}
        step={1}
        help="Set it to the last week to run to the end."
        onChange={(w) => props.onChange(withField(s, "lastWeek", w >= weeks ? undefined : Math.round(w) - 1))}
      />
    </>
  );
}
