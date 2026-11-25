# @glassrank/engine

The [GlassRank](https://github.com/SonofNun15/glassrank-engine) rating engine. Pure and
deterministic: no I/O, no clock, no randomness. The same input gives
byte-identical output on every platform.

| Function | Does |
| --- | --- |
| `rate(request)` | Rate one event: new rating states plus a receipt per player explaining the change |
| `predict(request)` | Win probability and expected score for a planned game |
| `forecast(request)` | How ratings would change for possible results, before playing |
| `replay(request)` | Re-rate an ordered event log, e.g. after a match is voided |
| `verify(request)` | Re-run a receipt's request and confirm the receipt |
| `explainReceipt(receipt)` | Plain-language explanation of a receipt |

Every function validates its input against `@glassrank/schema` and throws a
`SchemaError` listing every problem.

Apache-2.0.
