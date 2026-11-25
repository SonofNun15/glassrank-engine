import { Logo } from "@glassrank/design";
import { ExternalLink, Mail, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NAV, SOURCE_URL } from "../links";
import { Link, href, usePath } from "../router";

export function Header() {
  const path = usePath();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Logo href={href("/")} />
        <nav className="site-nav" aria-label="Main">
          <button
            className="site-nav__toggle gr-btn gr-btn--ghost gr-btn--sm"
            type="button"
            aria-expanded={open}
            aria-controls="site-nav-links"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="gr-icon" strokeWidth={1.75} /> : <Menu className="gr-icon" strokeWidth={1.75} />}
          </button>
          <ul id="site-nav-links" className={open ? "site-nav__links is-open" : "site-nav__links"}>
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="site-nav__link">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a className="site-nav__link" href={SOURCE_URL} target="_blank" rel="noreferrer">
                Source code
                <ExternalLink className="gr-icon site-nav__ext" strokeWidth={1.75} aria-hidden="true" />
              </a>
            </li>
            <li className="site-nav__cta">
              <Link to="/waitlist" className="gr-btn gr-btn--primary gr-btn--sm">
                <Mail className="gr-icon" width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
                Join the waitlist
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
