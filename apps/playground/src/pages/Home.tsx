import { Button, GlassPanel, RatingBadge, ReceiptCard } from "@glassrank/design";
import { ArrowRight, BookOpen, Eye, HeartHandshake, Mail, Play, Receipt, ShieldCheck, TrendingUp } from "lucide-react";
import { type MouseEvent, useMemo } from "react";
import { EVIDENCE } from "../evidence";
import { SOURCE_URL } from "../links";
import { href, navigate } from "../router";
import { SAMPLE_EVENT_LABEL, sampleReceipt } from "../sampleReceipt";

const icon = { className: "gr-icon", strokeWidth: 1.75, "aria-hidden": true } as const;

function go(to: string) {
  return (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(to);
  };
}

const PROBLEMS = [
  {
    title: "Your rating doesn't match how you actually play",
    body: "The most common complaint of all: the number never quite reflects your real level, and it's hard to tell whether the problem is you or the rating.",
  },
  {
    title: "You win your event and still lose rating",
    body: "You won the event your rating qualified you for, yet your rating dropped, probably because some wins over lower-rated players were too close. You can guess, but you can't see the math.",
  },
  {
    title: "The more you play, the more your rating locks in",
    body: "Players who play the most are often improving the fastest, yet their ratings get harder to move the more matches they log.",
  },
  {
    title: "One bad night can undo a month of progress",
    body: "Big swings make ratings feel arbitrary, especially for players coming back from a break.",
  },
];

const DIFFERENCES = [
  { Icon: Receipt, title: "Every change comes with a receipt", body: "See the games that mattered most, what the ratings expected, and every rule that applied." },
  { Icon: TrendingUp, title: "Built for players who improve", body: "Ratings stay responsive however much you play, and a strong night counts in full." },
  {
    Icon: ShieldCheck,
    title: "Gentle, capped declines",
    body: "A night at or above expectations never lowers your rating. Other drops are softened and capped each month, and your first events back from a break are protected.",
  },
  { Icon: Eye, title: "Nothing is secret", body: "The rating engine is open source. Every rule, and every change to the rules, is public." },
];

export function Home() {
  const sample = useMemo(sampleReceipt, []);
  const pct = (x: number) => x.toFixed(2);

  return (
    <>
      <section className="hero">
        <div className="page hero__inner">
          <div className="hero__copy">
            <span className="eyebrow">Free for players · Open source · In development</span>
            <h1 className="t-display-xl">Pickleball ratings you can see through</h1>
            <p className="t-body-lg lede">
              GlassRank is a rating system being built to rate the round robins, ladders, and tournaments you play, and to show you
              exactly why your rating moved. No black box and no surprises.
            </p>
            <div className="actions">
              <Button href={href("/test-court")} onClick={go("/test-court")} icon={<Play {...icon} />}>
                Put GlassRank to the test
              </Button>
              <Button variant="secondary" href={href("/how-it-works")} onClick={go("/how-it-works")} icon={<BookOpen {...icon} />}>
                How it works
              </Button>
            </div>
          </div>
          <GlassPanel className="hero__receipt">
            <span className="eyebrow">A real calculation on a made-up event</span>
            <ReceiptCard
              eyebrow={`${SAMPLE_EVENT_LABEL} · ${sample.date}`}
              delta={sample.receipt.headline.delta}
              explanation={sample.explanation}
            />
            <p className="t-small muted">
              The players, club, and games are made up. The math is real: your browser just ran GlassRank's open-source engine on
              them, the same code that would rate real events.
            </p>
          </GlassPanel>
        </div>
      </section>

      <section className="band">
        <div className="page stack">
          <div className="section-head">
            <h2 className="t-display-lg">Why ratings feel broken</h2>
            <p className="t-body-lg lede">These are the most common frustrations players describe with ratings today.</p>
          </div>
          <ul className="grid-2 problems">
            {PROBLEMS.map((p) => (
              <li key={p.title} className="problem">
                <h3 className="t-title">{p.title}</h3>
                <p className="muted-2">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="band band--sunken">
        <div className="page stack">
          <div className="section-head">
            <h2 className="t-display-lg">What GlassRank does differently</h2>
          </div>
          <ul className="grid-4 features">
            {DIFFERENCES.map(({ Icon, title, body }) => (
              <li key={title} className="feature">
                <span className="feature__icon">
                  <Icon className="gr-icon" width={24} height={24} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="t-title">{title}</h3>
                <p className="muted-2">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="band">
        <div className="page split">
          <div className="stack-sm">
            <h2 className="t-display-lg">New players get a range, not a number</h2>
            <p className="t-body-lg lede">
              When you join, GlassRank doesn't pretend to know your level. Your first eight events are provisional: your rating
              shows as a likely range that narrows as you play, and results count at full strength so a wrong starting guess
              corrects quickly.
            </p>
          </div>
          <div className="rating-demo">
            <div className="rating-demo__row">
              <span className="t-small muted">After your first event</span>
              <RatingBadge rating={3.2} provisional={{ low: 2.71, high: 4.1, eventsRemaining: 7 }} />
            </div>
            <div className="rating-demo__row">
              <span className="t-small muted">After five events</span>
              <RatingBadge rating={3.4} provisional={{ low: 3.18, high: 3.79, eventsRemaining: 3 }} />
            </div>
            <div className="rating-demo__row">
              <span className="t-small muted">Established</span>
              <RatingBadge rating={3.482} caption="Doubles" />
            </div>
          </div>
        </div>
      </section>

      <section className="band band--deep">
        <div className="page stack">
          <div className="section-head">
            <span className="eyebrow eyebrow--on-dark">Tested on simulated communities first</span>
            <h2 className="t-display-lg">Closer to how people actually play</h2>
            <p className="t-body-lg lede">
              In a simulated community of {EVIDENCE.players} players over {EVIDENCE.seasons} seasons, where we know every player's
              true level, GlassRank ratings stayed closer to that level than a standard rating did.
            </p>
          </div>
          <ul className="grid-3 stats">
            <li className="stat">
              <span className="stat__value">{`${EVIDENCE.closerToTruePct}% closer`}</span>
              <span>to players' true level, on average, than a standard rating</span>
            </li>
            <li className="stat">
              <span className="stat__value">{`${EVIDENCE.improversCloserPct}% closer`}</span>
              <span>for fast improvers, the players a standard rating leaves furthest behind</span>
            </li>
            <li className="stat">
              <span className="stat__value">Better predictions</span>
              <span>
                of who wins each game (prediction error {pct(EVIDENCE.logLoss.glassrank)} vs {pct(EVIDENCE.logLoss.elo)}; lower is
                better)
              </span>
            </li>
          </ul>
          <div className="actions">
            <Button href={href("/test-court")} onClick={go("/test-court")} icon={<ArrowRight {...icon} />}>
              Open the Test court
            </Button>
          </div>
        </div>
      </section>

      <section className="band band--earth">
        <div className="page split">
          <div className="stack-sm">
            <span className="eyebrow eyebrow--on-dark">
              <HeartHandshake {...icon} /> Planned as a nonprofit
            </span>
            <h2 className="t-display-lg">Ratings that belong to the community</h2>
            <p className="t-body-lg lede">
              We plan to form a nonprofit to run GlassRank once there's enough community support. Until then it's an open-source
              project, and these are the commitments it will be founded on.
            </p>
          </div>
          <ul className="commitments">
            <li>Free for players, always.</li>
            <li>Rules set in the open, with a public changelog for every change.</li>
            <li>Every rating change can be checked by anyone.</li>
            <li>Full data export, and your data is never sold.</li>
          </ul>
        </div>
      </section>

      <section className="band">
        <div className="page cta">
          <span className="eyebrow">Think it won't work?</span>
          <h2 className="t-display-lg">Try to break it</h2>
          <p className="t-body-lg lede">
            Open the Test court, change anything you like, and see whether the ratings hold up. If something looks wrong, send us
            the simulation that shows it. No clubs use GlassRank yet, and your feedback shapes what it becomes.
          </p>
          <div className="actions actions--center">
            <Button href={href("/test-court")} onClick={go("/test-court")} icon={<Play {...icon} />}>
              Open the Test court
            </Button>
            <Button variant="secondary" href={href("/updates")} onClick={go("/updates")} icon={<Mail {...icon} />}>
              Get updates
            </Button>
          </div>
          <p className="t-small muted">
            Prefer to check the math first?{" "}
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              Read the source code
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
