import type { AnchorHTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { formatDelta, formatRange, formatRating } from "./format";

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

type ButtonVariant = "primary" | "secondary" | "ghost";
interface ButtonBase {
  readonly variant?: ButtonVariant;
  readonly size?: "md" | "sm";
  /** A Lucide icon element, shown before the label. */
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}
export type ButtonProps =
  | (ButtonBase & { readonly href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
  | (ButtonBase & { readonly href: string } & AnchorHTMLAttributes<HTMLAnchorElement>);

/** One primary button per view. A `href` renders a link that looks like a button. */
export function Button({ variant = "primary", size = "md", icon, children, className, ...rest }: ButtonProps) {
  const classes = cx("gr-btn", `gr-btn--${variant}`, size === "sm" && "gr-btn--sm", className);
  if ("href" in rest && rest.href !== undefined) {
    return (
      <a className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <button className={classes} type="button" {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {icon}
      {children}
    </button>
  );
}

/** Frames the one thing a view is explaining. */
export function GlassPanel({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <section className={cx("gr-pane", className)}>{children}</section>;
}

export interface ProvisionalRange {
  readonly low: number;
  readonly high: number;
  readonly eventsRemaining: number;
}

/** A rating, or its likely range while provisional. */
export function RatingBadge(props: {
  readonly rating: number;
  readonly provisional?: ProvisionalRange | null;
  readonly caption?: string;
  readonly size?: "md" | "xl";
}) {
  const p = props.provisional ?? null;
  const caption =
    p === null ? props.caption : `Provisional · ${p.eventsRemaining} event${p.eventsRemaining === 1 ? "" : "s"} to go`;
  return (
    <span className={cx("gr-rating", props.size === "xl" && "gr-rating--xl", p !== null && "gr-rating--provisional")}>
      <span className="gr-rating__value">{p === null ? formatRating(props.rating) : formatRange(p.low, p.high)}</span>
      {caption === undefined ? null : <span className="gr-rating__meta">{caption}</span>}
    </span>
  );
}

/** A rating change: sign, arrow, and color together. */
export function DeltaChip({ value }: { readonly value: number }) {
  const text = formatDelta(value);
  const dir = text.startsWith("+") ? "up" : text.startsWith("−") ? "down" : "none";
  const label = dir === "up" ? `Up ${text.slice(1)}` : dir === "down" ? `Down ${text.slice(1)}` : "No change";
  return (
    <span className={`gr-delta gr-delta--${dir}`} aria-label={label}>
      {dir === "up" ? "↑ " : dir === "down" ? "↓ " : ""}
      {text}
    </span>
  );
}

export interface Explanation {
  readonly headline: string;
  readonly summary: readonly string[];
  readonly details: readonly string[];
}

/** Drops the leading "<delta>[ at <event>]. " from an engine headline; the card shows those separately. */
export function headlineBody(headline: string): string {
  return headline.replace(/^[+−±]\d+\.\d{3}(?: at [^.]+)?\.\s*/, "");
}

/** One rating change explained in the engine's three tiers. Render engine text; never hand-write it. */
export function ReceiptCard(props: { readonly eyebrow: string; readonly delta: number; readonly explanation: Explanation }) {
  const e = props.explanation;
  return (
    <article className="gr-receipt">
      <span className="gr-receipt__eyebrow">{props.eyebrow}</span>
      <div className="gr-receipt__head">
        <DeltaChip value={props.delta} />
        <p className="gr-receipt__headline">{headlineBody(e.headline)}</p>
      </div>
      <ul className="gr-receipt__summary">
        {e.summary.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <details>
        <summary>How the rating was calculated</summary>
        <ul className="gr-receipt__summary">
          {e.details.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

/** A labeled input with help or error text. */
export function Field({
  id,
  label,
  help,
  error,
  ...input
}: { readonly id: string; readonly label: string; readonly help?: string; readonly error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx("gr-field", error !== undefined && "gr-field--invalid")} htmlFor={id}>
      <span className="gr-field__label">{label}</span>
      <input className="gr-input" id={id} aria-invalid={error !== undefined} {...input} />
      {error !== undefined ? (
        <span className="gr-field__error">{error}</span>
      ) : help !== undefined ? (
        <span className="gr-field__help">{help}</span>
      ) : null}
    </label>
  );
}

/** A small status or category label. */
export function Tag({
  tone = "default",
  icon,
  children,
}: {
  readonly tone?: "default" | "brand" | "highlight";
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <span className={cx("gr-tag", tone !== "default" && `gr-tag--${tone}`)}>
      {icon}
      {children}
    </span>
  );
}

/** The GlassRank mark: a forest pane, a glass pane, and a climbing rating line. */
export function Mark({ size = 28, title }: { readonly size?: number; readonly title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#1F5E3B" />
      <rect x="15" y="11" width="38" height="42" rx="8" fill="#FFFFFF" fillOpacity="0.18" />
      <polyline points="11,45 22,39 31,41 41,28 53,19" fill="none" stroke="#E9CF4F" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark plus the name set in Archivo 800. */
export function Logo({ href }: { readonly href?: string }) {
  const content = (
    <>
      <Mark />
      <span className="gr-logo__word">GlassRank</span>
    </>
  );
  return href === undefined ? (
    <span className="gr-logo">{content}</span>
  ) : (
    <a className="gr-logo" href={href} aria-label="GlassRank home">
      {content}
    </a>
  );
}
