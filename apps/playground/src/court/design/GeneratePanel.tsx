/** Start from a generated world: a few plain dials instead of an empty page. */
import { Button } from "@glassrank/design";
import type { SimulationRecipeV2 } from "@glassrank/sim";
import { Shuffle, X } from "lucide-react";
import { useState } from "react";
import { countAction } from "../../analytics";
import { Checkbox } from "./EventEditor";
import { SelectField } from "./fields";
import { DEFAULT_OPTIONS, generateWorld, type ClubSize, type GenerateOptions, type Level, type TournamentCulture, type Travel } from "./generate";

const icon = { className: "gr-icon", width: 16, height: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
/** A fresh seed for each world. The seed travels with the recipe, so a generated world is still exactly reproducible. */
const newSeed = () => Math.floor(Math.random() * 4_294_967_295);

export function GeneratePanel(props: { readonly onGenerate: (recipe: SimulationRecipeV2) => void; readonly onClose: () => void }) {
  const [dials, setDials] = useState<Omit<GenerateOptions, "seed">>(DEFAULT_OPTIONS);
  const [made, setMade] = useState(0);
  const set = <K extends keyof typeof dials>(key: K, value: (typeof dials)[K]) => setDials((d) => ({ ...d, [key]: value }));

  return (
    <section className="design__generate stack-sm" aria-labelledby="generate-title">
      <Button variant="ghost" size="sm" className="design__generate-close" onClick={props.onClose} aria-label="Close" title="Close">
        <X {...icon} />
      </Button>
      <div className="stack-xs">
        <h3 id="generate-title" className="t-title">
          Generate a world
        </h3>
        <p className="t-small muted">
          Pick a few dials and get a complete world of made-up clubs, leagues, tournaments, and players. It replaces your current design; run it to
          see the results, or edit it first.
        </p>
      </div>
      <div className="design__grid">
        <SelectField
          label="Clubs"
          value={String(dials.clubs)}
          options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: n === 1 ? "1 club" : `${n} clubs` }))}
          onChange={(v) => set("clubs", Number(v))}
        />
        <SelectField<ClubSize>
          label="Club size"
          value={dials.size}
          options={[
            { value: "small", label: "Small (about 25 players)" },
            { value: "medium", label: "Medium (about 45)" },
            { value: "large", label: "Large (about 70)" },
            { value: "mixed", label: "A mix of sizes" },
          ]}
          onChange={(v) => set("size", v)}
        />
        <SelectField<Level>
          label="Players' level"
          value={dials.level}
          options={[
            { value: "beginners", label: "Mostly newer players (around 2.9)" },
            { value: "mixed", label: "A mix (around 3.4)" },
            { value: "strong", label: "Mostly strong players (around 3.9)" },
          ]}
          onChange={(v) => set("level", v)}
        />
        <SelectField<TournamentCulture>
          label="Tournaments"
          value={dials.tournaments}
          options={[
            { value: "none", label: "None" },
            { value: "one", label: "One club runs a monthly tournament" },
            { value: "several", label: "Several clubs do" },
          ]}
          onChange={(v) => set("tournaments", v)}
        />
        <SelectField<Travel>
          label="Travel"
          value={dials.travel}
          options={[
            { value: "homebodies", label: "Homebodies: rarely leave their club" },
            { value: "some", label: "Some travel, mostly for tournaments" },
            { value: "road-trippers", label: "Road-trippers: often play elsewhere" },
          ]}
          onChange={(v) => set("travel", v)}
        />
        <SelectField
          label="Length"
          value={String(dials.weeks)}
          options={[
            { value: "26", label: "6 months" },
            { value: "52", label: "1 year" },
            { value: "104", label: "2 years" },
          ]}
          onChange={(v) => set("weeks", Number(v))}
        />
      </div>
      <Checkbox
        label="Add two featured players to follow"
        checked={dials.featured}
        help="One claims a rating well above their level and plays down; one improves fast and plays up."
        onChange={(v) => set("featured", v)}
      />
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            countAction("generate-world");
            props.onGenerate(generateWorld({ ...dials, seed: newSeed() }));
            setMade((n) => n + 1);
          }}
          icon={<Shuffle {...icon} />}
        >
          {made === 0 ? "Generate" : "Generate another"}
        </Button>
      </div>
    </section>
  );
}
