/**
 * One tournament: a name, a schedule, and who may enter, shared by its
 * divisions; each division is its own event with its own rating range.
 */
import { Button } from "@glassrank/design";
import type { Club, EventSeries, SimulationRecipeV2 } from "@glassrank/sim";
import { Plus, Trash2 } from "lucide-react";
import { divisionName, newDivision, renameTournament } from "./defaults";
import { Checkbox, EventEditor } from "./EventEditor";
import { More, RowDisclosure, TextField } from "./fields";
import { ExtentFields, ScheduleFields, describeSchedule } from "./schedule";

const small = { className: "gr-icon", width: 16, height: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export function TournamentEditor(props: {
  readonly name: string;
  readonly club: Club;
  readonly divisions: readonly EventSeries[];
  readonly recipe: SimulationRecipeV2;
  readonly starts: readonly { readonly home: string; readonly rating: number }[];
  readonly canAddDivision: boolean;
  readonly defaultOpen?: boolean;
  readonly onChange: (next: SimulationRecipeV2) => void;
}) {
  const { name, club, divisions, recipe, onChange } = props;
  const first = divisions[0] as EventSeries;
  const ids = new Set(divisions.map((d) => d.id));
  const otherClubs = recipe.clubs.filter((c) => c.id !== club.id);
  /** Apply a change to every division of this tournament. */
  const all = (patch: (e: EventSeries) => EventSeries) => onChange({ ...recipe, events: recipe.events.map((e) => (ids.has(e.id) ? patch(e) : e)) });
  const setSchedule = (schedule: EventSeries["schedule"]) => all((e) => ({ ...e, schedule: { ...schedule, ...(e.schedule.hour === undefined ? {} : { hour: e.schedule.hour }) } as EventSeries["schedule"] }));
  const setOnlyFrom = (onlyFrom: readonly string[] | undefined) =>
    all((e) => {
      const { onlyFrom: _, ...rest } = e;
      return onlyFrom === undefined ? rest : { ...rest, onlyFrom };
    });
  const meta = [`Tournament · ${describeSchedule(first.schedule)}`, `${divisions.length} division${divisions.length === 1 ? "" : "s"}: ${divisions.map(divisionName).join(", ")}`]
    .concat(first.onlyFrom === undefined ? [] : [first.onlyFrom.length === 0 ? "home club only" : "some clubs only"])
    .join(" · ");

  return (
    <li>
      <RowDisclosure title={<strong>{name}</strong>} meta={meta} {...(props.defaultOpen === undefined ? {} : { defaultOpen: props.defaultOpen })}>
        <div className="design__grid">
          <TextField
            label="Tournament name"
            value={name}
            maxLength={40}
            help="Every division's name starts with it."
            onChange={(to) => to.trim() !== "" && onChange(renameTournament(recipe, club.id, name, to))}
          />
          <ScheduleFields schedule={first.schedule} durationDays={recipe.durationDays} onChange={setSchedule} />
        </div>
        <More label="More tournament settings">
          <div className="design__grid">
            <ExtentFields schedule={first.schedule} durationDays={recipe.durationDays} onChange={setSchedule} />
          </div>
          {otherClubs.length > 0 ? (
            <fieldset className="design__invites">
              <legend className="gr-field__label">Players from other clubs</legend>
              <Checkbox
                label="Open to every club"
                checked={first.onlyFrom === undefined}
                help="Most tournaments welcome anyone. Players come from other clubs if they're willing to travel for tournaments."
                onChange={(on) => setOnlyFrom(on ? undefined : [])}
              />
              {first.onlyFrom !== undefined ? (
                <>
                  <span className="gr-field__help">Only these clubs, besides {club.label ?? club.id}:</span>
                  {otherClubs.map((c) => (
                    <Checkbox
                      key={c.id}
                      label={c.label ?? c.id}
                      checked={first.onlyFrom?.includes(c.id) ?? false}
                      onChange={(on) => {
                        const list = on ? [...(first.onlyFrom ?? []), c.id] : (first.onlyFrom ?? []).filter((x) => x !== c.id);
                        setOnlyFrom(recipe.clubs.map((x) => x.id).filter((x) => list.includes(x)));
                      }}
                    />
                  ))}
                </>
              ) : null}
            </fieldset>
          ) : null}
        </More>

        <div className="stack-xs">
          <span className="gr-field__label">
            Divisions <span className="muted">({divisions.length})</span>
          </span>
          <ul className="design__groups">
            {divisions.map((d) => (
              <EventEditor
                key={d.id}
                event={d}
                recipe={recipe}
                starts={props.starts}
                inTournament
                onChange={(next) => onChange({ ...recipe, events: recipe.events.map((e) => (e.id === d.id ? next : e)) })}
                onRemove={() => onChange({ ...recipe, events: recipe.events.filter((e) => e.id !== d.id) })}
              />
            ))}
          </ul>
        </div>
        <div className="actions">
          <Button
            variant="secondary"
            size="sm"
            disabled={!props.canAddDivision}
            onClick={() => onChange({ ...recipe, events: [...recipe.events, newDivision(recipe, divisions)] })}
            icon={<Plus {...small} />}
          >
            Add a division
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...recipe, events: recipe.events.filter((e) => !ids.has(e.id)) })} icon={<Trash2 {...small} />}>
            Remove {name} ({divisions.length} division{divisions.length === 1 ? "" : "s"})
          </Button>
        </div>
      </RowDisclosure>
    </li>
  );
}
