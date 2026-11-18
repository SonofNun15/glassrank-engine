# GlassRank

An open, transparent rating engine for pickleball.

Every rating change can be explained, reproduced, and verified. The engine and
its data model are open source under the Apache License 2.0; anyone can run it,
audit it, and propose improvements.

> Status: early skeleton. Nothing here is usable yet.

## Principles

1. **Transparency.** Players can see exactly how and why a rating changed, and
   preview how an upcoming result would change it.
2. **Free for players, always.** The core rating is never behind a paywall.
3. **Built for improvement.** The system keeps up with fast-improving players.
4. **Gentle with declines.** Downward moves are slow and cautious.
5. **Community governance.** Rating rules are set in the open.

## Packages

| Package | Purpose |
| --- | --- |
| `@glassrank/schema` | Versioned types: events, matches, rating state, receipts, policy config |
| `@glassrank/engine` | Pure, deterministic `rate(priorStates, event, policy)`: evidence layer + policy layer |
| `@glassrank/sim` | Synthetic players and events, plus metrics for scoring the engine |

## Development

Requires Node 22+ and pnpm (via `corepack enable`).

```sh
pnpm install
pnpm build
pnpm test
```

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
The GlassRank name is not covered by the Apache license; see
[TRADEMARKS.md](TRADEMARKS.md).
