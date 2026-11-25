# @glassrank/schema

The versioned data model for [GlassRank](https://github.com/SonofNun15/glassrank):
events, seeds, rating state, policy, receipts, and the request and response for
every engine entry point.

Each schema is three things at once: a TypeScript type, a runtime validator
(`parse(Schema, json)` returns errors with JSON pointers), and a JSON Schema
document. The JSON Schema files ship in `json-schema/`, and example documents
in `fixtures/`.

Also included: canonical JSON (RFC 8785), SHA-256 content hashes, and strict
UTC timestamp handling.

```ts
import { EventInput, parse } from "@glassrank/schema";
const result = parse(EventInput, JSON.parse(text));
if (!result.ok) console.log(result.issues); // [{ path: "/matches/0/teams", message: "..." }]
```

Apache-2.0.
