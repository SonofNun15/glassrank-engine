/**
 * A small client-side router: a handful of routes doesn't need a library.
 * Paths are app-relative ("/example"); the deploy base path is added and
 * removed here. Swap for a router library when routes get parameters.
 */
import { type AnchorHTMLAttributes, type MouseEvent, useSyncExternalStore } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const CHANGE = "glassrank:navigate";

function currentPath(): string {
  const path = window.location.pathname.startsWith(BASE) ? window.location.pathname.slice(BASE.length) : window.location.pathname;
  return path === "" ? "/" : path.replace(/\/$/, "") || "/";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, currentPath, () => "/");
}

export const href = (to: string) => `${BASE}${to}`;

export function navigate(to: string): void {
  window.history.pushState(null, "", href(to));
  window.dispatchEvent(new Event(CHANGE));
  window.scrollTo({ top: 0 });
}

/** An in-app link: a real <a> (so open-in-new-tab works) that navigates without a reload. */
export function Link({ to, onClick, ...rest }: { readonly to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const path = usePath();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={href(to)} aria-current={path === to ? "page" : undefined} onClick={handle} {...rest} />;
}
