import { type JSX, useEffect } from "react";
import { Footer } from "./layout/Footer";
import { Header } from "./layout/Header";
import { Home } from "./pages/Home";
import { HowItWorks } from "./pages/HowItWorks";
import { NotFound } from "./pages/NotFound";
import { TestCourt } from "./pages/TestCourt";
import { Updates } from "./pages/Updates";
import { countPage } from "./analytics";
import { href, usePath } from "./router";

const ROUTES: Record<string, { readonly title: string; readonly Page: () => JSX.Element }> = {
  "/": { title: "GlassRank: pickleball ratings you can see through", Page: Home },
  "/how-it-works": { title: "How it works · GlassRank", Page: HowItWorks },
  "/test-court": { title: "Test court · GlassRank", Page: TestCourt },
  "/updates": { title: "Get updates · GlassRank", Page: Updates },
};

/** Earlier paths that now live elsewhere. */
const ALIASES: Record<string, string> = { "/example": "/test-court", "/sandbox": "/test-court", "/waitlist": "/updates" };

export function App() {
  const raw = usePath();
  const path = ALIASES[raw] ?? raw;
  const route = ROUTES[path] ?? { title: "Page not found · GlassRank", Page: NotFound };
  useEffect(() => {
    document.title = route.title;
    countPage(href(path), route.title);
  }, [path, route.title]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <p className="status-note">
        <strong>In development.</strong> No clubs use GlassRank yet. Everything on this site runs on simulated or made-up players.
      </p>
      <main id="main">
        <route.Page />
      </main>
      <Footer />
    </>
  );
}
