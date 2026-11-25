# @glassrank/cli

`glassrank`: the [GlassRank](https://github.com/SonofNun15/glassrank) engine
as a command, for services written in any language.

```sh
glassrank <rate|predict|forecast|replay|verify|explain|simulate|version> [input.json] [--pretty]
```

Reads a JSON request from the file or stdin and writes the JSON response to
stdout as canonical JSON (RFC 8785), so identical requests give
byte-identical responses. `--pretty` indents the output for reading.

Exit codes: `0` success; `2` invalid input, invalid JSON, or unknown command
(stdout holds `{"error": {"code", "message", "issues"}}`); `1` internal error.

Apache-2.0.
