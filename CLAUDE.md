# GlassRank: guidance for coding agents

GlassRank is an open-source (Apache-2.0) pickleball rating engine. This repo holds
only the open parts: the data model, the engine, and the simulator. The hosted
service, API, and apps are proprietary and live elsewhere (to be run by a nonprofit
we plan to form once there is community support; it does not exist yet).

Read `docs/design/engine-v0.md` before working on the engine or simulator.

## Repo layout

- `packages/schema`: versioned types (events, matches, scores, rating state, receipts, policy config).
- `packages/engine`: `rate(priorStates, event, policy) -> { states, receipts }`.
- `packages/sim`: synthetic world plus metrics that score the engine.
- `packages/cli`: `glassrank` JSON command line.
- `packages/design`: GlassRank design system in code (tokens.css generated from
  tokens.json, component CSS, React components). The reference is the GlassRank
  Design System artifact; keep tokens.json in sync with it.
- `apps/playground`: the public site (Vite + React): landing page, example
  simulation, sandbox. Builds straight from workspace sources via Vite aliases.

Dependency direction: playground -> sim -> engine -> schema; playground and
design are browser code (DOM, JSX); the engine packages never get DOM types.

## Hard rules for the engine

- Pure and deterministic: no I/O, no `Date.now()`, no `Math.random()`. Time and
  randomness come in as inputs (timestamps on events; seeded RNG only in `sim`).
- Same inputs give byte-identical outputs across machines. Avoid iteration-order
  dependence; sort explicitly.
- Every rating change produces a receipt that explains it (what the evidence said,
  what each policy rule did) and contains enough input to reproduce it.
- The forecast function must call the same code path as real updates.
- Policy parameters are data (a versioned config object), never constants buried in code.

## Commands

```sh
corepack enable
pnpm install
pnpm build      # tsdown in each package (dependency order) -> dist/index.js + index.d.ts
pnpm test       # type-checks all sources and tests, then vitest (runs from source, no build needed)
pnpm generate   # rewrite generated files (JSON Schema, fixtures, engine/sim goldens) from source; review the diff
pnpm sim        # build, then compare rating systems on the default simulated world
pnpm dev        # run the public site locally (apps/playground)
```

## Conventions

- TypeScript strict, ESM, `Bundler` resolution. Import siblings without a file
  extension (`./event`, not `./event.js`). tsdown bundles each package, so the
  published output has no relative imports.
- Cross-package imports use the package name (`@glassrank/schema`). The root
  tsconfig `paths` and the vitest aliases point those at source.
- Tests next to source as `*.test.ts`.
- Commits must be signed off (`git commit -s`), per CONTRIBUTING.md.
- Prefer small, reviewable commits. Behavior changes to rating math need sim results.
