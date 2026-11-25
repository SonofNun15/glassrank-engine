# Versioning and compatibility

Three things are versioned separately.

## Schema (`SCHEMA_VERSION`, carried in every document)

- **Patch** (0.1.0 → 0.1.1): no change to any document's shape. Docs and
  descriptions only.
- **Minor while major is 0** (0.1 → 0.2): shapes may change. Documents must
  match the engine's minor version; older documents need migrating.
- **From 1.0:** minor versions only add optional fields or new variants;
  removing or changing anything is a major version.

The engine rejects documents from an incompatible schema version.

## Engine (`ENGINE_VERSION`, recorded in every state and receipt)

- **Patch:** no change to any output for any input. All golden files and
  conformance cases are unchanged.
- **Minor:** outputs may change for some inputs (a fix or a new feature). The
  changelog says which conformance cases changed and why. Old receipts still
  verify only against the engine version that produced them.
- **Major:** a change to how ratings are computed that the rating committee
  must approve, with simulation results.

## Policy (`policyId` and `policyHash`, recorded in every state and receipt)

Policies are data, not code. Every published policy and correction overlay
gets a new `policyId`, an entry in the public changelog, and appears in the
`PolicySchedule` with its effective dates. A policy never changes after it is
published; a change is a new policy. `policyHash` lets anyone confirm exactly
which numbers were used.

## Reproducing an old receipt

A receipt records the engine version, policy hash, and input hash. To verify
it, run `verify` with the stored request using the engine version named in
the receipt. Published package versions stay available for this.
