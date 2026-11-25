/**
 * Share links: a simulation's recipe (and the player being followed),
 * compressed into the part of the address after "#". That part never reaches
 * a server, so the static site can share simulations on its own, and a run
 * rebuilt from a link is the same run, down to every rating change.
 *
 * Format: "#r1.<base64url(deflate-raw(JSON))>". The "r1" is this format's
 * version; the recipe inside carries its own recipe version and the engine
 * and simulator versions it was made with.
 */
import { ENGINE_VERSION } from "@glassrank/engine";
import { parse } from "@glassrank/schema";
import { GLASSRANK, SIM_V2_VERSION, SimulationRecipeV2 } from "@glassrank/sim";

const PREFIX = "r1.";

interface SharePayload {
  readonly recipe: SimulationRecipeV2;
  /** The player being followed in Explore, if any. */
  readonly player?: string;
}

export type ShareResult =
  | {
      readonly ok: true;
      readonly recipe: SimulationRecipeV2;
      readonly player: string | null;
      /** True when the link was made with a different engine or simulator version, so results may differ. */
      readonly otherVersion: boolean;
    }
  | { readonly ok: false; readonly message: string };

/** The recipe stamped with the versions that produce its results. */
export function stamped(recipe: SimulationRecipeV2): SimulationRecipeV2 {
  return { ...recipe, createdWith: { engineVersion: ENGINE_VERSION, simVersion: SIM_V2_VERSION, policyId: GLASSRANK.policyId } };
}

export function hasShare(hash: string): boolean {
  return hash.replace(/^#/, "").startsWith(PREFIX);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** The fragment (without "#") for a recipe and the player being followed. */
export async function encodeShare(recipe: SimulationRecipeV2, player?: string | null): Promise<string> {
  const payload: SharePayload = { recipe: stamped(recipe), ...(player ? { player } : {}) };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  return PREFIX + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

/** Read a share fragment (with or without "#"). Never throws: a broken link is a message, not a crash. */
export async function decodeShare(hash: string): Promise<ShareResult> {
  const fragment = hash.replace(/^#/, "");
  if (!fragment.startsWith(PREFIX)) return { ok: false, message: "This isn't a Test court share link." };
  let payload: unknown;
  try {
    const bytes = await pipe(fromBase64Url(fragment.slice(PREFIX.length)), new DecompressionStream("deflate-raw"));
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, message: "This share link is incomplete or damaged. Try copying the whole link again." };
  }
  if (typeof payload !== "object" || payload === null || !("recipe" in payload)) {
    return { ok: false, message: "This share link doesn't contain a simulation." };
  }
  const parsed = parse(SimulationRecipeV2, (payload as { recipe: unknown }).recipe);
  if (!parsed.ok) {
    const version = parsed.issues.find((i) => i.path.endsWith("/recipeVersion"));
    return {
      ok: false,
      message: version
        ? "This link was made with a different version of the Test court and can't be opened here."
        : `This share link's simulation isn't valid: ${parsed.issues[0]?.message ?? "unknown problem"}.`,
    };
  }
  const recipe = parsed.value;
  const made = recipe.createdWith;
  const player = (payload as { player?: unknown }).player;
  return {
    ok: true,
    recipe,
    player: typeof player === "string" ? player : null,
    otherVersion: made !== undefined && (made.engineVersion !== ENGINE_VERSION || made.simVersion !== SIM_V2_VERSION),
  };
}
