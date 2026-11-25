/** One featured player: the settings most people want up front, the rest under "More settings". */
import { Button } from "@glassrank/design";
import type { PlayerSpec, SimulationRecipeV2 } from "@glassrank/sim";
import { Trash2 } from "lucide-react";
import { APPETITE_STOPS, ATTENDANCE_STOPS, LOYALTY_STOPS, TOURNAMENT_STOPS, TOURNAMENT_TRAVEL_STOPS, TRAVEL_STOPS, VOLATILITY_STOPS } from "../sliders";
import { PRESETS, startOf } from "./defaults";
import { CardDisclosure, More, NumberField, ScaleSlider, SelectField, TextField } from "./fields";
import { SkillEditor } from "./SkillEditor";

type Source = PlayerSpec["startingRating"]["source"];
const SOURCES: readonly { value: Source; label: string }[] = [
  { value: "self", label: "Claims a rating" },
  { value: "club", label: "Club assigns a rating" },
  { value: "external", label: "Brings a rating from another system" },
  { value: "default", label: "No starting rating" },
];

export function PlayerCard(props: {
  readonly player: PlayerSpec;
  readonly recipe: SimulationRecipeV2;
  readonly onChange: (next: PlayerSpec) => void;
  readonly onRemove: () => void;
  /** Pair this player with another featured player (or none), on both sides. */
  readonly onPartner: (partner: string | null) => void;
  readonly defaultOpen?: boolean;
}) {
  const { player: p, recipe, onChange } = props;
  const set = (patch: Partial<PlayerSpec>) => onChange({ ...p, ...patch });
  const name = p.label ?? p.id;
  const claimed = p.startingRating.source === "default" ? null : p.startingRating.rating;

  const club = recipe.clubs.find((c) => c.id === p.home)?.label ?? p.home;
  const curve = `${PRESETS.find((x) => x.value === p.skill.preset)?.label ?? p.skill.preset} from ${startOf(p.skill).toFixed(2)}`;
  const start = claimed === null ? "default starting rating" : `starts at ${claimed.toFixed(2)}`;

  return (
    <li>
      <CardDisclosure title={name} meta={`${club} · ${curve} · ${start}`} {...(props.defaultOpen === undefined ? {} : { defaultOpen: props.defaultOpen })}>
      <div className="design__grid">
        <TextField label="Name" value={p.label ?? ""} maxLength={60} help="Use a made-up name." onChange={(v) => set({ label: v })} />
        <SelectField label="Home club" value={p.home} options={recipe.clubs.map((c) => ({ value: c.id, label: c.label ?? c.id }))} onChange={(home) => set({ home })} />
      </div>

      <SkillEditor skill={p.skill} joinDay={p.joinDay} durationDays={recipe.durationDays} name={name} onChange={(skill) => set({ skill })} />

      <div className="design__grid">
        <ScaleSlider label="Volatility" stops={VOLATILITY_STOPS} value={p.volatility} onChange={(volatility) => set({ volatility })} />
        <ScaleSlider label="Appetite" stops={APPETITE_STOPS} value={p.appetite} onChange={(appetite) => set({ appetite })} />
      </div>

      <div className="design__grid">
        <SelectField<Source>
          label="Where their starting rating comes from"
          value={p.startingRating.source}
          options={SOURCES}
          onChange={(source) =>
            set({ startingRating: source === "default" ? { source } : { source, rating: claimed ?? 3.5 } })
          }
        />
        {claimed !== null && p.startingRating.source !== "default" ? (
          <NumberField
            label="Rating"
            value={claimed}
            min={2}
            max={8}
            step={0.05}
            help="Set it above or below their true skill to see how fast GlassRank corrects it."
            onChange={(rating) => p.startingRating.source !== "default" && set({ startingRating: { ...p.startingRating, rating } })}
          />
        ) : (
          <p className="t-small muted design__note">They start at GlassRank's default rating for new players.</p>
        )}
      </div>

      <More>
        <div className="design__grid">
          <ScaleSlider label="Travel for leagues" stops={TRAVEL_STOPS} value={p.travel} onChange={(travel) => set({ travel })} />
          <ScaleSlider label="Plays" stops={ATTENDANCE_STOPS} value={p.attendance} onChange={(attendance) => set({ attendance })} />
          <ScaleSlider label="Tournaments" stops={TOURNAMENT_STOPS} value={p.tournaments ?? 0.2} onChange={(tournaments) => set({ tournaments })} />
          <ScaleSlider
            label="Travel for tournaments"
            stops={TOURNAMENT_TRAVEL_STOPS}
            value={p.tournamentTravel ?? 0.5}
            onChange={(tournamentTravel) => set({ tournamentTravel })}
          />
          <ScaleSlider label="Partner loyalty" stops={LOYALTY_STOPS} value={p.loyalty ?? 0.6} onChange={(loyalty) => set({ loyalty })} />
          <SelectField
            label="Fixed tournament partner"
            value={p.partner ?? ""}
            options={[
              { value: "", label: "None: finds partners as they go" },
              ...recipe.players.filter((x) => x.id !== p.id).map((x) => ({ value: x.id, label: x.label ?? x.id })),
            ]}
            help="Fixed partners always enter together, pick a division they can both play, and never split up."
            onChange={(partner) => props.onPartner(partner === "" ? null : partner)}
          />
        </div>
        <NumberField
          label="Joins in week"
          value={p.joinDay + 7}
          min={1}
          max={Math.ceil(recipe.durationDays / 7)}
          step={1}
          scale={7}
          help="When they start playing."
          onChange={(v) => set({ joinDay: Math.max(0, v - 7) })}
        />
      </More>
      <div>
        <Button variant="ghost" size="sm" onClick={props.onRemove} icon={<Trash2 className="gr-icon" width={16} height={16} strokeWidth={1.75} aria-hidden="true" />}>
          Remove {name}
        </Button>
      </div>
      </CardDisclosure>
    </li>
  );
}
