# Conformance cases

Inputs and exact expected outputs for every engine command. An implementation
conforms when, for every case in `cases.json`, running `<command>` with the
case's input on stdin prints exactly the expected output (byte for byte) and
exits with the expected code.

```sh
pnpm build && node conformance/check.mjs          # this repo's CLI
node conformance/check.mjs -- ./my-port            # any implementation
```

The second form runs `./my-port <command>` for each case, so a port only
needs the same calling convention as `glassrank`.

| Command | Cases |
| --- | --- |
| rate | Elo policy; Bayesian policy with provisional newcomers; an active correction (damping, correction, and decline cap all fire); a voided match; a missing prior (error, exit 2) |
| predict | One doubles game |
| forecast | The standard outcome set |
| replay | Two events with a policy schedule |
| verify | A matching receipt; a tampered receipt |
| explain | A newcomer's receipt rendered to text |
| version | Version report |

Outputs are canonical JSON (RFC 8785) followed by a newline. The cases are
generated from `packages/cli/src/generated.test.ts`; regenerate with
`pnpm generate` only when behavior changes on purpose, and note it in the
changelog.
