# Summary 13-01: Remote-access hardening

**Completed:** 2026-10-10 · **Status:** VERIFIED_COMPLETE

## What changed

- Non-loopback binds, including Docker (`DOCKER=true` → `0.0.0.0`), refuse to start unless `T3MP3ST_BEARER_TOKEN` or `T3MP3ST_BEARER_TOKEN_FILE` is set. The file path is logged only when it cannot be read. The token is never logged.
- `/api` on those binds requires `Authorization: Bearer` (missing and wrong both 401) and a per-IP token bucket: 60/minute, burst 120, `429` with `Retry-After`. `/`, `/ui`, and `/health` stay open.
- Loopback does not mount the guard. No prompt, no limit.
- The MCP proxy sends the bearer when it is set and still refuses a non-loopback `T3MP3ST_URL` without one.
- The browser shell adds the header only when `localStorage.t3mp3st_bearer_token` is set.
- Docker healthcheck sends the bearer. Docs, changelog, grokbot README, and the roster note match.

## Verification

- `remote-access-guard` + `grokbot-gateway` + tauri scaffold + local-API static: 53/53.
- `tsc --noEmit` clean.
- No token value is committed (test pins that `server.ts` does not assign one).
