import { Button, GlassPanel } from "@glassrank/design";
import { ExternalLink } from "lucide-react";
import { countAction } from "../analytics";

/** The "GlassRank updates" Google Form. */
export const UPDATES_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSddsrPm9gBC4IwQ3EclK1mjOAM9z4Jemqp0qS1967-QeEFnXg/viewform";

export function Updates() {
  return (
    <div className="page page-body stack">
      <div className="section-head">
        <span className="eyebrow">Updates</span>
        <h1 className="t-display-lg">Get updates</h1>
        <p className="t-body-lg lede">
          Hear when GlassRank is ready to try, and help decide where it starts. No clubs use GlassRank yet, and there's no launch date.
        </p>
      </div>
      <div className="split split--top">
        <GlassPanel className="stack-sm">
          <p className="muted-2">Sign up with a short Google Form. We'll ask for:</p>
          <ul className="plain-list">
            <li>Your email</li>
            <li>Your name, if you'd like</li>
            <li>How you're involved in pickleball: playing, organizing, running a club, coaching</li>
            <li>Where you play, if you'd like (it helps us choose where to start)</li>
            <li>How involved you'd like to be: keep posted, try it at your club or events, give feedback on the rules, or help build it</li>
          </ul>
          <div>
            <Button href={UPDATES_FORM} target="_blank" rel="noreferrer" onClick={() => countAction("sign-up")} icon={<ExternalLink className="gr-icon" width={16} height={16} strokeWidth={1.75} aria-hidden="true" />}>
              Sign up
            </Button>
          </div>
          <p className="t-small muted">Opens in a new tab.</p>
        </GlassPanel>
        <div className="stack-sm">
          <h2 className="t-title">What we'll do with it</h2>
          <ul className="plain-list muted-2">
            <li>Email you only about GlassRank.</li>
            <li>Remove you and delete your answers whenever you ask.</li>
            <li>Never sell or share your details.</li>
            <li>Keep your answers in Google Forms, read only by the GlassRank volunteers. If the planned nonprofit is formed, they'll move to it.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
