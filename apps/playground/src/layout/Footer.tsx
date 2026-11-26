import { Logo } from "@glassrank/design";
import { NAV, SOURCE_URL } from "../links";
import { Link } from "../router";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Logo />
          <p>
            An open-source pickleball rating system in development. We plan to form a nonprofit to run it once there's enough
            community support. Free for players, always.
          </p>
          <p className="site-footer__note">
            No clubs use GlassRank yet. Every player, club, game, and rating on this site is simulated or made up.
          </p>
        </div>
        <ul className="site-footer__links" aria-label="Footer">
          <li>
            <Link to="/updates">
              <strong>Get updates</strong>
            </Link>
          </li>
          {NAV.map((item) => (
            <li key={item.to}>
              <Link to={item.to}>{item.label}</Link>
            </li>
          ))}
          <li>
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              Source code on GitHub
            </a>
          </li>
          <li className="site-footer__note">Code licensed under Apache 2.0</li>
        </ul>
      </div>
    </footer>
  );
}
