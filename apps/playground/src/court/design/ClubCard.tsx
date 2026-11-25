/** One club: its name and status, its events (read-only for now), and its groups of players. */
import { Button } from "@glassrank/design";
import type { Club, EventSeries, PlayerGroup, SimulationRecipeV2 } from "@glassrank/sim";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { APPETITE_STOPS, ATTENDANCE_STOPS, TRAVEL_STOPS, VOLATILITY_STOPS } from "../sliders";
import { GROUP_TEMPLATES, PRESETS, groupStart, presetGroupSkill, type Preset } from "./defaults";
import { CardDisclosure, More, NumberField, RangeField, SelectField, TextField } from "./fields";

const WEEKDAYS = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];
const small = { className: "gr-icon", width: 16, height: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
type GroupPreset = Exclude<Preset, "keyframes">;

export function rangeText(range: EventSeries["range"]): string {
  if (range?.min !== undefined && range.max !== undefined) return `${range.min.toFixed(1)}–${range.max.toFixed(1)}`;
  if (range?.max !== undefined) return `${range.max.toFixed(1)} and under`;
  if (range?.min !== undefined) return `${range.min.toFixed(1)} and up`;
  return "All levels";
}

/** A range of a plain-language scale, shown as the labels its ends fall on. */
function scaleRange(label: string, stops: typeof VOLATILITY_STOPS, value: readonly [number, number], min: number, max: number, onChange: (v: [number, number]) => void) {
  const near = (v: number) => stops.reduce((b, s) => (Math.abs(s.value - v) < Math.abs(b.value - v) ? s : b)).label;
  return (
    <RangeField
      label={label}
      value={value}
      min={min}
      max={max}
      step={0.05}
      help={`From “${near(value[0])}” to “${near(value[1])}”.`}
      onChange={onChange}
    />
  );
}

function GroupEditor(props: { readonly group: PlayerGroup; readonly durationDays: number; readonly onChange: (g: PlayerGroup) => void; readonly onRemove: () => void }) {
  const { group: g, onChange } = props;
  const set = (patch: Partial<PlayerGroup>) => onChange({ ...g, ...patch });
  const skill = g.skill;
  const setSkill = (patch: Record<string, readonly [number, number]>) => set({ skill: { ...skill, ...patch } as PlayerGroup["skill"] });
  const weeks = (label: string, key: string, value: readonly [number, number], min = 0) => (
    <RangeField label={label} value={value} min={min} max={260} step={1} scale={7} onChange={(v) => setSkill({ [key]: v })} />
  );

  return (
    <li className="design__group stack-sm">
      <div className="design__card-head">
        <span className="t-body">
          <span className="mono">{g.count}</span> {g.label ?? g.id}
        </span>
        <Button variant="ghost" size="sm" onClick={props.onRemove} icon={<Trash2 {...small} />}>
          Remove
        </Button>
      </div>
      <div className="design__grid">
        <TextField label="Group name" value={g.label ?? ""} maxLength={60} onChange={(label) => set({ label })} />
        <NumberField label="Players" value={g.count} min={1} max={500} step={1} onChange={(count) => set({ count: Math.round(count) })} />
        {skill.preset !== "keyframes" ? (
          <SelectField<GroupPreset>
            label="How their skill changes"
            value={skill.preset}
            options={PRESETS.filter((p) => p.value !== "keyframes").map((p) => ({ value: p.value as GroupPreset, label: p.label }))}
            onChange={(preset) => {
              const [lo, hi] = groupStart(skill);
              set({ skill: presetGroupSkill(preset, lo, hi) });
            }}
          />
        ) : null}
        <RangeField
          label={skill.preset === "steady" ? "Skill level" : "Starting skill"}
          value={groupStart(skill)}
          min={2}
          max={8}
          step={0.05}
          help="Each player's level is drawn from this range."
          onChange={(v) => setSkill(skill.preset === "steady" ? { level: v } : { start: v })}
        />
      </div>
      <More>
        <div className="design__grid">
          {skill.preset === "gradual_improver" || skill.preset === "fast_improver" ? (
            <>
              <RangeField label="Total improvement" value={skill.gain} min={0} max={4} step={0.05} onChange={(v) => setSkill({ gain: v })} />
              {weeks("Weeks to get halfway", "halfDays", skill.halfDays, 1)}
            </>
          ) : null}
          {skill.preset === "slow_decline" ? <RangeField label="Skill lost per year" value={skill.perYear} min={0} max={2} step={0.01} onChange={(v) => setSkill({ perYear: v })} /> : null}
          {skill.preset === "break_and_return" ? (
            <>
              {weeks("Break starts after (weeks)", "breakDay", skill.breakDay)}
              {weeks("Break length (weeks)", "breakDays", skill.breakDays, 1)}
              <RangeField label="Skill lost to rust" value={skill.rust} min={0} max={3} step={0.05} onChange={(v) => setSkill({ rust: v })} />
              {weeks("Weeks to shake off the rust", "recoveryDays", skill.recoveryDays, 1)}
            </>
          ) : null}
          {skill.preset === "plateau_then_jump" ? (
            <>
              {weeks("Jump starts after (weeks)", "jumpDay", skill.jumpDay)}
              <RangeField label="Size of the jump" value={skill.jump} min={-3} max={3} step={0.05} onChange={(v) => setSkill({ jump: v })} />
              {weeks("Weeks the jump takes", "jumpDays", skill.jumpDays, 1)}
            </>
          ) : null}
          <RangeField
            label="Join in week"
            value={[g.joinDay[0] + 7, g.joinDay[1] + 7]}
            min={1}
            max={Math.ceil(props.durationDays / 7)}
            step={1}
            scale={7}
            help="Players join at random weeks in this range."
            onChange={([a, b]) => set({ joinDay: [Math.max(0, a - 7), Math.max(0, b - 7)] })}
          />
          {scaleRange("Volatility", VOLATILITY_STOPS, g.volatility, 0, 1, (volatility) => set({ volatility }))}
          {scaleRange("Appetite", APPETITE_STOPS, g.appetite, -1, 1, (appetite) => set({ appetite }))}
          {scaleRange("Travel", TRAVEL_STOPS, g.travel, 0, 1, (travel) => set({ travel }))}
          {scaleRange("Plays", ATTENDANCE_STOPS, g.attendance, 0, 1, (attendance) => set({ attendance }))}
        </div>
      </More>
    </li>
  );
}

export function ClubCard(props: {
  readonly club: Club;
  readonly recipe: SimulationRecipeV2;
  readonly canRemove: boolean;
  readonly canAddGroup: boolean;
  readonly onChange: (next: SimulationRecipeV2) => void;
  readonly onRemove: () => void;
  readonly onAddGroup: (club: string, template: (typeof GROUP_TEMPLATES)[number]) => void;
  readonly defaultOpen?: boolean;
}) {
  const { club: c, recipe, onChange } = props;
  const [template, setTemplate] = useState(GROUP_TEMPLATES[0]!.label);
  const setClub = (patch: Partial<Club>) => onChange({ ...recipe, clubs: recipe.clubs.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) });
  const setGroup = (id: string, g: PlayerGroup) => onChange({ ...recipe, groups: recipe.groups.map((x) => (x.id === id ? g : x)) });
  const removeGroup = (id: string) => onChange({ ...recipe, groups: recipe.groups.filter((x) => x.id !== id) });
  const groups = recipe.groups.filter((g) => g.home === c.id);
  const events = recipe.events.filter((e) => e.club === c.id);
  const count = groups.reduce((n, g) => n + g.count, 0);

  const meta = `${c.tier === "verified_host" ? "Verified" : "Provisional"} · ${events.length} event${events.length === 1 ? "" : "s"} · ${count} player${count === 1 ? "" : "s"} in ${groups.length} group${groups.length === 1 ? "" : "s"}`;

  return (
    <li>
      <CardDisclosure title={c.label ?? c.id} meta={meta} {...(props.defaultOpen === undefined ? {} : { defaultOpen: props.defaultOpen })}>
      <div className="design__grid">
        <TextField label="Club name" value={c.label ?? ""} maxLength={60} help="Use a made-up name." onChange={(label) => setClub({ label })} />
        <SelectField
          label="Status"
          value={c.tier}
          options={[
            { value: "verified_host", label: "Verified club" },
            { value: "provisional_host", label: "Provisional club" },
          ]}
          help="Under the proposed rules, results from provisional clubs count at 60% of a verified club’s."
          onChange={(tier) => setClub({ tier })}
        />
      </div>

      <div className="stack-xs">
        <span className="gr-field__label">Events</span>
        {events.length === 0 ? (
          <p className="t-small muted">No events. This club's players only play when they travel.</p>
        ) : (
          <ul className="design__list">
            {events.map((e) => (
              <li key={e.id}>
                <strong>{e.label ?? e.id}</strong>{" "}
                <span className="muted-2">
                  {e.label === rangeText(e.range) ? "" : `· ${rangeText(e.range)} `}· {e.schedule.kind === "weekly" ? WEEKDAYS[e.schedule.weekday] : `day ${e.schedule.day}`} · up to {e.capacity}
                  {(e.invites ?? []).length > 0 ? " · open to other clubs" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="stack-xs">
        <span className="gr-field__label">
          Players <span className="muted">({count})</span>
        </span>
        <ul className="design__groups">
          {groups.map((g) => (
            <GroupEditor key={g.id} group={g} durationDays={recipe.durationDays} onChange={(next) => setGroup(g.id, next)} onRemove={() => removeGroup(g.id)} />
          ))}
        </ul>
        <div className="design__add">
          <SelectField
            label="Add a group of players"
            value={template}
            options={GROUP_TEMPLATES.map((t) => ({ value: t.label, label: t.label }))}
            onChange={setTemplate}
          />
          <Button variant="secondary" size="sm" disabled={!props.canAddGroup} onClick={() => props.onAddGroup(c.id, GROUP_TEMPLATES.find((t) => t.label === template) ?? GROUP_TEMPLATES[0]!)} icon={<Plus {...small} />}>
            Add group
          </Button>
        </div>
      </div>
      <div>
        <Button variant="ghost" size="sm" disabled={!props.canRemove} onClick={props.onRemove} icon={<Trash2 {...small} />}>
          Remove {c.label ?? c.id}
        </Button>
      </div>
      </CardDisclosure>
    </li>
  );
}
