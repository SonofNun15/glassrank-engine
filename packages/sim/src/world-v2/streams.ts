/**
 * Random streams keyed by what they are for, never consumed in one sequence.
 * Lengthening a run leaves earlier weeks byte-identical, and changing one
 * player touches only the draws that involve that player.
 */

/** Stable 32-bit key for a string id (FNV-1a over UTF-16 code units). */
export function idKey(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

/** First key of every fork from the recipe's root stream. */
export const STREAM = {
  /** (group, index): a generated player's settings. */
  traits: 1,
  /** (player): starting rating. */
  seed: 2,
  /** (week, player): attendance, travel, and this week's target level. */
  week: 3,
  /** (week, player): sign-up order, which settles full events. */
  signup: 4,
  /** (series, occurrence): everything that happens at one event. */
  occurrence: 5,
} as const;
