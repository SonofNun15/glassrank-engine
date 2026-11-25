/**
 * Plain-language scales for player settings. Visitors set them by feel; the
 * recipe stores the exact numbers (see docs/design/sim-world-v2.md).
 */

export interface Stop {
  readonly position: number;
  readonly value: number;
  readonly label: string;
  readonly meaning: string;
}

/** Volatility: slider positions 0–100 map to a spread between these points. */
export const VOLATILITY_STOPS: readonly Stop[] = [
  { position: 0, value: 0, label: "Low", meaning: "Always plays at their true skill." },
  { position: 33, value: 0.05, label: "Low", meaning: "Almost always plays at their level." },
  { position: 67, value: 0.15, label: "Medium", meaning: "Has good and bad days." },
  { position: 100, value: 0.3, label: "High", meaning: "Hard to predict: some days well above, some well below." },
];

/** Appetite: positions 0–100 map to −1 … +1. */
export const APPETITE_STOPS: readonly Stop[] = [
  { position: 0, value: -1, label: "Plays down", meaning: "Picks events where they're among the strongest." },
  { position: 25, value: -0.5, label: "Leans down", meaning: "Prefers to be near the top of an event." },
  { position: 50, value: 0, label: "Plays at their level", meaning: "Picks events that fit their rating." },
  { position: 75, value: 0.5, label: "Leans up", meaning: "Likes a challenge." },
  { position: 100, value: 1, label: "Plays up", meaning: "Seeks events above their level." },
];

/** Value for a slider position, linear between stops. */
export function valueAt(stops: readonly Stop[], position: number): number {
  for (let i = 1; i < stops.length; i++) {
    const b = stops[i] as Stop;
    if (position <= b.position) {
      const a = stops[i - 1] as Stop;
      return a.value + ((b.value - a.value) * (position - a.position)) / (b.position - a.position);
    }
  }
  return (stops.at(-1) as Stop).value;
}

/** Slider position for a value (inverse of valueAt). */
export function positionOf(stops: readonly Stop[], value: number): number {
  for (let i = 1; i < stops.length; i++) {
    const b = stops[i] as Stop;
    if (value <= b.value) {
      const a = stops[i - 1] as Stop;
      if (b.value === a.value) return a.position;
      return Math.max(0, a.position + ((b.position - a.position) * (value - a.value)) / (b.value - a.value));
    }
  }
  return 100;
}

/** The stop nearest a slider position, for its label. */
export function nearestStop(stops: readonly Stop[], position: number): Stop {
  return stops.reduce((best, s) => (Math.abs(s.position - position) < Math.abs(best.position - position) ? s : best));
}

/** Travel: chance each week of looking at other clubs' events. */
export const TRAVEL_STOPS: readonly Stop[] = [
  { position: 0, value: 0, label: "Stays home", meaning: "Only plays at their home club." },
  { position: 50, value: 0.2, label: "Sometimes travels", meaning: "Looks at other clubs' events about one week in five." },
  { position: 100, value: 0.6, label: "Travels often", meaning: "Looks at other clubs' events most weeks." },
];

/** Attendance: chance of playing in a given week. */
export const ATTENDANCE_STOPS: readonly Stop[] = [
  { position: 0, value: 0.1, label: "Now and then", meaning: "Plays about one week in ten." },
  { position: 50, value: 0.5, label: "Every other week", meaning: "Plays about half the weeks." },
  { position: 100, value: 1, label: "Every week", meaning: "Never misses a week." },
];

/** Tournaments: chance of entering (or agreeing to partner in) a tournament they could play in. */
export const TOURNAMENT_STOPS: readonly Stop[] = [
  { position: 0, value: 0, label: "Never", meaning: "Doesn't play tournaments." },
  { position: 33, value: 0.1, label: "Rarely", meaning: "Enters about one tournament in ten." },
  { position: 67, value: 0.4, label: "Sometimes", meaning: "Enters a fair share of the tournaments they could play." },
  { position: 100, value: 0.9, label: "Most tournaments", meaning: "Plays nearly every tournament they can." },
];

/** Loyalty: how much they stick with one tournament partner. */
export const LOYALTY_STOPS: readonly Stop[] = [
  { position: 0, value: 0.05, label: "New partner most events", meaning: "Rarely plays with the same partner twice." },
  { position: 50, value: 0.5, label: "Sometimes the same", meaning: "Sticks with a partner for a while, then moves on." },
  { position: 100, value: 0.95, label: "Same partner every time", meaning: "Keeps a partner for event after event, unless a rough day splits them up." },
];
