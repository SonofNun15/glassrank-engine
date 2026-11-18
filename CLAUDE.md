# GlassRank: guidance for coding agents

GlassRank is an open-source (Apache-2.0) pickleball rating engine. This repo holds
only the open parts: the data model, the engine, and the simulator. The hosted
service, API, and apps are proprietary and live elsewhere (run by a nonprofit).

Read `docs/design/engine-v0.md` before working on the engine or simulator.

## Repo layout

- `packages/schema`: versioned types (events, matches, scores, rating state, receipts, policy config).
- `packages/engine`: `rate(priorStates, event, policy) -> { states, receipts }`.
- `packages/sim`: synthetic world plus metrics that score the engine.

Dependency direction: sim -> engine -> schema. Never the reverse.

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
pnpm build      # tsc -b
pnpm test       # builds, then vitest
```

## Conventions

- TypeScript strict, ESM, NodeNext resolution. Import siblings with `.js` suffix.
- Tests next to source as `*.test.ts`.
- Commits must be signed off (`git commit -s`), per CONTRIBUTING.md.
- Prefer small, reviewable commits. Behavior changes to rating math need sim results.
