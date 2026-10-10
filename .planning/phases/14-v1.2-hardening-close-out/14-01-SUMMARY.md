# Summary 14-01: v1.2 gates

**Completed:** 2026-10-10 · **Status:** VERIFIED_COMPLETE

## Gates (repo root, after `5ec3be5`)

| Gate | Result |
|---|---|
| `npm run lint` | exit 0. 0 errors, 176 pre-existing warnings (`no-explicit-any`, non-null assertions). None in the v1.2 files. |
| `npx tsc --noEmit` | clean |
| `npm test` | 87 files, 989 tests passed; ops preflight 11/11; model-matrix 19/19; refusal-frontier self-test included in the script (exit 0) |
| `npm run doctor` | exit 0. Warnings only: `nmap`, `nuclei`, `semgrep`, `promptfoo` not installed; API health offline because no server was running |
| `npm run prompt:audit` | exit 0. Directive preservation: 39 template units matched the baseline |

## Docs

`docs/TAURI.md`, `docs/API_REFERENCE.md`, `docs/DOCKER.md`, `docs/GETTING_STARTED.md`, `docs/MCP_GUIDE.md`, `docs/CHANGELOG.md`, and `grokbot/README.md` cover bundle completion, the sidecar, and remote hardening.

## Not claimed

A full `tauri build` installer was not produced on this host. Mobile `gen/` is still blocked on JDK/Android SDK and on macOS/Xcode (`docs/TAURI.md` §5).
