# Schema fixtures

Example documents for the main seam objects. Tests validate each one with both
the TypeScript validator and the published JSON Schema (via Ajv), and other
implementations can use them as conformance inputs.

## Hand-written (edit these)

| File | Schema |
| --- | --- |
| `event.json` | `EventInput`: a four-player doubles round robin with rotating partners |
| `policy.json` | `PolicyConfig`: example parameters for the Elo baseline, not a proposal |
| `overlay.json` | `CorrectionOverlay`: an example correction-dial setting |
| `priors.json` | `Prior[]`: two stored rating states and two seeds, one per player in `event.json` |
| `receipt.json` | `Receipt`: one player's receipt for that event, except `provenance.inputHash` and `provenance.policyHash` |

## Generated (do not edit)

| File | Built from |
| --- | --- |
| `rate-request.json` | `priors.json` + `event.json` + `policy.json` |
| `receipt.json` hashes | the hash of `rate-request.json` and of its `policy` |

After changing a hand-written file, run `pnpm generate` and review the diff.
`pnpm test` fails until the generated files match their sources.

The numbers in `receipt.json` and the rating states are illustrative until the
engine exists (milestones 4 to 6). Their shape is real. Once `rate()` exists,
the engine will generate the receipt instead.
