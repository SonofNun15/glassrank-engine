/**
 * Feedback goes to a Google Form, opened in a new tab with the simulation's
 * share link (and the followed player's name) filled in. The site itself sends
 * nothing: the visitor reads the form and submits it on Google.
 *
 * The entry ids come from the form's "Get pre-filled link". If the form's
 * questions are rebuilt, make a new pre-filled link and update them here.
 */
import type { SimulationRecipeV2 } from "@glassrank/sim";

export const FEEDBACK_FORM = {
  url: "https://docs.google.com/forms/d/e/1FAIpQLSfz1DngQOnR3EUGg7y4ea_Mzf5eIu07T_350O8UaBv6RExRwg/viewform",
  /** "Simulation link" */
  linkEntry: "entry.14025785",
  /** "Which player or event?" */
  playerEntry: "entry.1262010978",
} as const;

/** Google rejects pre-filled addresses much over 8,100 characters (measured Nov 2026); stay under with room to spare. */
export const MAX_FORM_URL = 8000;

export interface FeedbackLink {
  /** The form's address, pre-filled. */
  readonly url: string;
  /** False when the share link was too long to pre-fill; the visitor pastes it in instead. */
  readonly linkIncluded: boolean;
}

export function feedbackLink(shareUrl: string, player: string | null): FeedbackLink {
  const params = new URLSearchParams({ usp: "pp_url" });
  if (player !== null) params.set(FEEDBACK_FORM.playerEntry, player);
  const withoutLink = `${FEEDBACK_FORM.url}?${params.toString()}`;
  params.set(FEEDBACK_FORM.linkEntry, shareUrl);
  const full = `${FEEDBACK_FORM.url}?${params.toString()}`;
  return full.length <= MAX_FORM_URL ? { url: full, linkIncluded: true } : { url: withoutLink, linkIncluded: false };
}

/**
 * A player's name as the Test court shows it: "Rosa (made up)" or "Steady players · #12, North Courts (made up)".
 * Null when the recipe has no such player (say, one removed in Design).
 */
export function playerLabel(recipe: SimulationRecipeV2, id: string): string | null {
  if (id.startsWith("p.")) {
    const spec = recipe.players.find((p) => `p.${p.id}` === id);
    if (spec !== undefined) return spec.label ?? spec.id;
  }
  const dot = id.lastIndexOf(".");
  const group = recipe.groups.find((g) => g.id === id.slice(0, dot));
  const n = Number(id.slice(dot + 1));
  if (group === undefined || !Number.isInteger(n) || n < 1 || n > group.count) return null;
  const club = recipe.clubs.find((c) => c.id === group.home);
  return `${group.label ?? group.id} · #${n}${club === undefined ? "" : `, ${club.label ?? club.id}`}`;
}
