import { GlassPanel, Tag } from "@glassrank/design";

export function Waitlist() {
  return (
    <div className="page page-body stack">
      <div className="section-head">
        <span className="eyebrow">Waitlist</span>
        <h1 className="t-display-lg">Join the waitlist</h1>
        <p className="t-body-lg lede">
          Hear when GlassRank is ready to try, and help decide where it starts. No clubs use GlassRank yet, and there's no launch date.
        </p>
      </div>
      <div className="split split--top">
        <GlassPanel>
          <Tag>Opening soon</Tag>
          <p className="muted-2">
            We're setting up the waitlist. Nothing is collected on this site yet, so there's nothing to fill in today.
          </p>
          <p className="muted-2">When it opens, we'll ask for:</p>
          <ul className="plain-list">
            <li>Your email</li>
            <li>Whether you're a player, an organizer, or a club</li>
            <li>Your area, if you'd like (it helps us choose where to start)</li>
            <li>How involved you'd like to be: follow along, try it at your club or event, or advise</li>
          </ul>
        </GlassPanel>
        <div className="stack-sm">
          <h2 className="t-title">What we'll do with it</h2>
          <ul className="plain-list muted-2">
            <li>Email you only about GlassRank.</li>
            <li>Let you unsubscribe and delete your details at any time.</li>
            <li>Never sell or share your details.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
