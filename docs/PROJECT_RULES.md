# Project validation rules

Put `forge.rules.json` at the root of an X4 extension when the mod has deterministic facts the Forge cannot infer
from static source alone. The file is optional. When present, version 1 is validated strictly by the same referee
used by the Studio, agent API, CLI, compile, release, and deploy checks.

The machine-readable schema is [`docs/schemas/forge.rules.schema.v1.json`](schemas/forge.rules.schema.v1.json).

## Safety contract

- Rules never suppress an error.
- A general suppression must name an exact diagnostic `code` and an exact `file`, `sourceRef`, or both. Globs,
  regular expressions, and code-only suppressions are rejected.
- Suppressions and known-good chains need an owner, a meaningful reason, and `reviewBy`. The date must be today or
  later and no more than 366 days away. An overdue or malformed declaration makes project validation fail and no
  suppression is applied.
- IDs are unique across the whole file. Unknown properties and unsupported versions fail validation.
- A declaration that currently matches no warning is reported in `rules.unmatched`; it does not create another
  warning. This keeps a genuinely clean active-warning count at zero while leaving stale-rule review machine-readable.
- `summary.rawWarnings`, `summary.suppressedWarnings`, and `summary.activeWarnings` distinguish observed findings
  from reviewed exceptions. `rules.suppressed` retains the complete original diagnostic and rule provenance.

## Example

```json
{
  "$schema": "https://raw.githubusercontent.com/KennyG1990/X4_Forge/main/docs/schemas/forge.rules.schema.v1.json",
  "version": 1,
  "suppressions": [
    {
      "id": "dynamic-log-listener",
      "owner": "mod-maintainer",
      "reason": "The host installs this dynamic listener after menu initialization.",
      "reviewBy": "2027-01-30",
      "code": "lua_md.missing_listener",
      "file": "ui/addons/my_mod/main.lua",
      "sourceRef": "my_mod.log_"
    }
  ],
  "contracts": {
    "knownChains": [
      {
        "id": "cargo-free-chain",
        "owner": "mod-maintainer",
        "reason": "Confirmed in game and generated through an import-backed property.",
        "reviewBy": "2027-01-30",
        "chain": "$ship.cargo.free.all",
        "file": "md/my_mod.xml"
      }
    ],
    "wireKeys": [
      {
        "id": "wire-offer",
        "key": "offer",
        "scope": "global",
        "reason": "Every indexed step carries the shared offer payload."
      }
    ],
    "expectedRegisters": [
      {
        "id": "register-open",
        "event": "my_mod.open",
        "file": "ui/addons/my_mod/main.lua",
        "reason": "Mission Director raises this exact UI bridge event."
      }
    ]
  }
}
```

`wireKeys` requires both the exact indexed MD reader scope and Lua writer unless `requireReader` or
`requireWriter` is explicitly `false`. Setting both false is invalid. `expectedRegisters` accepts an exact AST-found
registration or an AST-proven dynamic prefix that covers the declared event; an optional `file` narrows the evidence.
`knownChains` applies only to exact `scriptproperty.*` warnings and can be narrowed to one file.

Run the same engine without opening the Studio:

```powershell
npm run validate:mod -- "C:\path\to\extensions\my_mod"
```

JSON mode includes the loaded-file list, active flat diagnostics, rule matches, unmatched declarations, and suppressed
diagnostic provenance:

```powershell
npm run validate:mod -- "C:\path\to\extensions\my_mod" --json
```
