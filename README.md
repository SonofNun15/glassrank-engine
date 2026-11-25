# GlassRank

An open, transparent rating engine for pickleball.

Every rating change can be explained, reproduced, and verified. The engine and
its data model are open source under the Apache License 2.0; anyone can run it,
audit it, and propose improvements.

> Status: 0.1.0, pre-release. The engine, data model, and simulator work end
> to end; the rating policy is an untuned draft and has not met real play yet.

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
| `@glassrank/cli` | `glassrank` command: JSON in, JSON out, for services in any language |
| `@glassrank/sim` | Simulated communities, reproducible simulation recipes, and metrics for scoring rating policies |

## Using it

From TypeScript or JavaScript:

```ts
import { rate } from "@glassrank/engine";
const { states, receipts } = rate(request); // a RateRequest; see the schema
```

From any language, with the command-line tool:

```sh
glassrank rate < request.json > response.json
glassrank verify < verify-request.json
```

See [docs/integration.md](docs/integration.md) for how a service stores
ratings and calls the engine, [docs/compatibility.md](docs/compatibility.md)
for versioning, and [conformance/](conformance/) to check another
implementation against this one.

## Development

Requires Node 22+ and pnpm (via `corepack enable`).

```sh
pnpm install
pnpm build
pnpm test       # type-check and test from source
pnpm generate   # rewrite generated files after an intended change; review the diff
pnpm sim        # compare rating systems on a simulated community
```

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
The GlassRank name is not covered by the Apache license; see
[TRADEMARKS.md](TRADEMARKS.md).
