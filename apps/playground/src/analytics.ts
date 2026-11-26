/**
 * Visit counts with GoatCounter (goatcounter.com): no cookies, no personal
 * data, and disclosed in the site footer. The script in index.html loads with
 * automatic counting off; this module counts each page the app shows and a
 * few named actions.
 *
 * What's sent: the page's path (never the "#..." part, which holds share
 * links' simulations), its title, the referring site on the first page only,
 * and screen width. GoatCounter skips localhost, so development isn't counted.
 */

interface CountVars {
  readonly path: string;
  readonly title?: string;
  readonly referrer?: string;
  readonly event?: boolean;
}

declare global {
  interface Window {
    goatcounter?: { count?: (vars: CountVars) => void };
  }
}

/** Counts made before the script finished loading. If it never loads (say, it's blocked), they're dropped. */
const waiting: CountVars[] = [];
let listening = false;

function send(vars: CountVars): void {
  if (typeof window === "undefined") return;
  const count = window.goatcounter?.count;
  if (count !== undefined) {
    count(vars);
    return;
  }
  if (waiting.length < 20) waiting.push(vars);
  if (listening) return;
  const script = document.querySelector("script[data-goatcounter]");
  if (script === null) return;
  listening = true;
  script.addEventListener("load", () => {
    for (const v of waiting.splice(0)) window.goatcounter?.count?.(v);
  });
}

let lastPage: string | null = null;

/** Count a page view. `path` is the full path without the "#..." part. */
export function countPage(path: string, title: string): void {
  if (path === lastPage) return;
  const first = lastPage === null;
  lastPage = path;
  // The first page keeps the browser's referrer (the site the visitor came from); later pages are moves within this site.
  send(first ? { path, title } : { path, title, referrer: "" });
}

/** The actions we count, by name. */
export type Action = "run-simulation" | "generate-world" | "share-link" | "send-feedback" | "sign-up";

const ACTION_TITLES: Readonly<Record<Action, string>> = {
  "run-simulation": "Ran a simulation from Design",
  "generate-world": "Generated a world",
  "share-link": "Made a share link",
  "send-feedback": "Opened the feedback form",
  "sign-up": "Opened the updates sign-up form",
};

/** Count an action, such as opening the feedback form. Only its name is sent. */
export function countAction(action: Action): void {
  send({ path: action, title: ACTION_TITLES[action], referrer: "", event: true });
}
