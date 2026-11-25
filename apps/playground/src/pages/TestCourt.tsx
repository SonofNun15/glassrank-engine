import { Button, GlassPanel, Tag } from "@glassrank/design";
import { Download, MessageSquareText, RotateCcw, Share2, SquarePlus } from "lucide-react";

const icon = { className: "gr-icon", strokeWidth: 1.75, "aria-hidden": true } as const;

const CAN_DO = [
  { title: "Explore", body: "It opens on a simulated community playing weekly round robins for three seasons. Follow any player's rating against their true level and open the receipt for any event." },
  { title: "Change anything", body: "Adjust the community, add players (including one like you), and change the rating rules. Compare GlassRank with a standard rating side by side." },
  { title: "Start over", body: "Reset to the example at any time, or start from scratch with an empty community." },
  { title: "Save and share", body: "Download your simulation or share it as a link. It's rebuilt exactly, down to every receipt, on anyone's screen." },
];

export function TestCourt() {
  return (
    <div className="page page-body stack">
      <div className="section-head">
        <span className="eyebrow">Test court</span>
        <h1 className="t-display-lg">Put GlassRank to the test</h1>
        <p className="t-body-lg lede">
          Start from a simulated community, change anything you like, and see whether the ratings hold up. Everything runs in your
          browser.
        </p>
      </div>

      <div className="court">
        <GlassPanel className="court__sim">
          <div className="court__toolbar">
            <Tag>Being built</Tag>
            <div className="actions">
              <Button variant="secondary" size="sm" disabled icon={<RotateCcw {...icon} width={16} height={16} />}>
                Reset to the example
              </Button>
              <Button variant="secondary" size="sm" disabled icon={<SquarePlus {...icon} width={16} height={16} />}>
                Start from scratch
              </Button>
              <Button variant="ghost" size="sm" disabled icon={<Download {...icon} width={16} height={16} />}>
                Download
              </Button>
              <Button variant="ghost" size="sm" disabled icon={<Share2 {...icon} width={16} height={16} />}>
                Share link
              </Button>
            </div>
          </div>
          <ul className="grid-2 court__plans">
            {CAN_DO.map((c) => (
              <li key={c.title} className="stack-xs">
                <h2 className="t-title">{c.title}</h2>
                <p className="muted-2">{c.body}</p>
              </li>
            ))}
          </ul>
        </GlassPanel>

        <aside className="court__feedback" aria-labelledby="feedback-title">
          <h2 id="feedback-title" className="t-title">
            Send feedback with this simulation
          </h2>
          <p className="muted-2">
            Found something that looks wrong, or right? Your feedback is sent together with the exact simulation on your screen, so
            we can rebuild what you saw and check it.
          </p>
          <Button disabled icon={<MessageSquareText {...icon} />}>
            Send feedback
          </Button>
          <p className="t-small muted">Feedback opens soon. Nothing is collected on this site yet.</p>
        </aside>
      </div>
    </div>
  );
}
