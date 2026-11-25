/**
 * A featured player's true skill: pick a preset and adjust it in plain words,
 * or switch to a custom curve and place points on the graph. Preset times are
 * shown in weeks after the player joins.
 */
import { Button } from "@glassrank/design";
import { type PlayerSkill, toKeyframes } from "@glassrank/sim";
import { Spline } from "lucide-react";
import { KeyframeEditor } from "./KeyframeEditor";
import { PRESETS, presetSkill, startOf, type Preset } from "./defaults";
import { NumberField, SelectField } from "./fields";

const WEEK = 7;

export function SkillEditor(props: {
  readonly skill: PlayerSkill;
  readonly joinDay: number;
  readonly durationDays: number;
  readonly name: string;
  readonly onChange: (next: PlayerSkill) => void;
}) {
  const { skill, joinDay, durationDays, onChange } = props;
  const set = (patch: Record<string, number>) => onChange({ ...skill, ...patch } as PlayerSkill);
  const skillField = (label: string, key: string, value: number, help?: string) => (
    <NumberField label={label} value={value} min={2} max={8} step={0.05} {...(help === undefined ? {} : { help })} onChange={(v) => set({ [key]: v })} />
  );
  const weeksField = (label: string, key: string, value: number, min = 0, help?: string) => (
    <NumberField label={label} value={value} min={min} max={260} step={1} scale={WEEK} {...(help === undefined ? {} : { help })} onChange={(v) => set({ [key]: Math.max(min * WEEK, v) })} />
  );

  return (
    <div className="stack-sm skill">
      <SelectField<Preset>
        label="True skill"
        value={skill.preset}
        options={PRESETS.map((p) => ({ value: p.value, label: p.label }))}
        help={PRESETS.find((p) => p.value === skill.preset)?.description}
        onChange={(preset) => {
          if (preset === skill.preset) return;
          onChange(preset === "keyframes" ? { preset, keyframes: toKeyframes(skill, joinDay, durationDays) } : presetSkill(preset, startOf(skill), durationDays));
        }}
      />

      {skill.preset === "keyframes" ? (
        <KeyframeEditor label={props.name} keyframes={skill.keyframes} durationDays={durationDays} onChange={(keyframes) => onChange({ preset: "keyframes", keyframes })} />
      ) : (
        <>
          <div className="design__grid">
            {skill.preset === "steady" ? skillField("Skill level", "level", skill.level) : skillField("Starting skill", "start", skill.start)}
            {skill.preset === "gradual_improver" || skill.preset === "fast_improver" ? (
              <>
                <NumberField label="Total improvement" value={skill.gain} min={0} max={4} step={0.05} help="How much better they eventually get." onChange={(v) => set({ gain: v })} />
                {weeksField("Weeks to get halfway", "halfDays", skill.halfDays, 1)}
              </>
            ) : null}
            {skill.preset === "slow_decline" ? (
              <NumberField label="Skill lost per year" value={skill.perYear} min={0} max={2} step={0.01} onChange={(v) => set({ perYear: v })} />
            ) : null}
            {skill.preset === "break_and_return" ? (
              <>
                {weeksField("Break starts after (weeks)", "breakDay", skill.breakDay)}
                {weeksField("Break length (weeks)", "breakDays", skill.breakDays, 1)}
                <NumberField label="Skill lost to rust" value={skill.rust} min={0} max={3} step={0.05} onChange={(v) => set({ rust: v })} />
                {weeksField("Weeks to shake off the rust", "recoveryDays", skill.recoveryDays, 1)}
              </>
            ) : null}
            {skill.preset === "plateau_then_jump" ? (
              <>
                {weeksField("Jump starts after (weeks)", "jumpDay", skill.jumpDay)}
                <NumberField label="Size of the jump" value={skill.jump} min={-3} max={3} step={0.05} help="Negative for a drop." onChange={(v) => set({ jump: v })} />
                {weeksField("Weeks the jump takes", "jumpDays", skill.jumpDays, 1)}
              </>
            ) : null}
          </div>
          <KeyframeEditor label={props.name} keyframes={toKeyframes(skill, joinDay, durationDays)} durationDays={durationDays} />
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onChange({ preset: "keyframes", keyframes: toKeyframes(skill, joinDay, durationDays) })}
              icon={<Spline className="gr-icon" width={16} height={16} strokeWidth={1.75} aria-hidden="true" />}
            >
              Edit points on the graph
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
