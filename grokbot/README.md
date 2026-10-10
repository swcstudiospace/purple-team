# grokbot/

What the red team needs in order to run on Grok Bot. Owner: COMMANDER
(`grokbot/**`). The five seat templates live in `templates/`, the seat
registry in `rosters/redteam.json`, and the seven saved skills in `skills/`.

| Path | What it is |
|---|---|
| `rosters/redteam.json` | The one roster: `team`, the loopback `gateway_url`, `roster_version`, and the five seat ids (empty until registration). |
| `templates/<SEAT>.md` | The five Grok Bot Team-only templates (name, description, first run, gateway, enabled skills, routines, avatar). Never hand-edit the shape; keep the section order. |
| `avatars/` | Seat avatars, `<seat>.png` (`commander.png` … `white.png`). Placeholder until the images are added. |
| `skills/` | Index of Grok Bot saved skills (`skills/index.json`) and the canonical copies that live in this repo (`tempest-*`). COMMANDER re-saves from the indexed ref into Grok Bot; those copies never write back. |

## Seat defaults

Every template's **Enabled skills** list always includes `tempest-bootstrap`:
a template arrives with no seat id and no memory, and without the bootstrap
flow the seat looks configured and is not. COMMANDER carries all seven
skills; team seats carry the subset named in their template.

Two negative defaults hold for every seat:

- **No raw credential or network scope.** A seat template lists no MCP
  server beyond the loopback gateway, and no tool that reaches past it.
  Loopback trust is the auth model here — the same trust the CLI already
  relies on. Anything the backend needs (provider keys, subscription
  sessions) stays on the server; the seat never sees it.
- **Skills are listed and invoked, never installed or approved by the seat.**
  The only route into the skill list is a reviewed change here.

## /tempest bootstrap registration flow

A recipient setup does not write seat ids by hand. Each of its Bots runs
`/tempest bootstrap` (`skills/tempest-bootstrap`), which reports that seat's
id back through the gateway; the operator records the reported id in
`rosters/redteam.json` under `seats.<seat>.id`. Once all five seats report
and the gateway answers `tempest_status` cleanly, the roster is live and the
templates can be published from it. A copy under `rosters/` is only needed
when the prompts are assembled outside the gateway (CI, a local check).

Per-user sessions are mission and engagement ids carried in skill text —
there is no new session store. The operator quotes the mission id back on
every follow-up (`/tempest-report <mission id>`, status polls, tasking), and
the backend resolves it. Off-loopback `/api` is rate-limited per caller IP
(not per seat).

## Bot auth: loopback trust, bearer off loopback

The bot proxy (the `tempest_*` MCP tools) talks to `T3MP3ST_URL`
(default `http://127.0.0.1:3333`). Loopback needs no token. A non-loopback
URL is refused unless `T3MP3ST_BEARER_TOKEN` (or `T3MP3ST_BEARER_TOKEN_FILE`)
is set; the proxy then sends `Authorization: Bearer <token>`. The server
binds non-loopback only when that same token is set, and it rate-limits
`/api` per caller (60/minute, burst 120). Never commit the token. The
browser UI reads it from `localStorage` key `t3mp3st_bearer_token` and does
not prompt on loopback.

## Integrity rule

Committed here: seat ids only (addressing, not credentials). Never committed
here: tokens, passphrases, hosts beyond loopback, or literal UUIDs. Seat ids
are addressing, not authentication: they identify a Bot, they do not
authenticate one. That is why the id fields start empty and fill in through
the bootstrap flow above instead of through committed secrets.

## Regenerate

There is no generator yet; templates are hand-maintained. Keep every
template's section order (title, Name, Description, First run, Gateway,
Enabled skills, Routines, Avatar) and keep every `skills/index.json` row
paired with its `SKILL.md`.

## Command registry

Every slash below is a saved skill under `skills/<id>/SKILL.md`, paired
with its `skills/index.json` row. Shared language rules (quoting,
`<target>`/`<scope>`/`<mission-id>`, unknown-command fallback,
ack→progress→completion, parked/resume) live in `skills/GRAMMAR.md`;
each skill references that file instead of restating the rules.

| Slash | Skill | One-line usage |
|---|---|---|
| `/tempest bootstrap` | `tempest-bootstrap` | Register the seat id and check gateway reachability on first run. |
| `/tempest-run "<objective>" [--target <host>] [--seat <seat>]` | `tempest-run` | Full run: intake, mission start, operator tasking, closing summary. |
| `/tempest-mission` | `tempest-mission` | Start, park, resume, pause, or stop a mission by mission id. |
| `/tempest-agents` | `tempest-operators` | List operators and dispatch work to one operator id. |
| `/tempest-status`, `/tempest-providers` | `tempest-status` | Read mission status plus provider and subscription-session state. |
| `/tempest-report <mission id>` | `tempest-report` | Export the engagement report for a mission id. |
| `/tempest-memory` | `tempest-memory` | Recall past work; read the memory capsule, accept or reject proposals. |
| `/black-specter "<red plan>" [--target <host>] [--mission <mission-id>]` | `black-specter` | Critique a red plan's covert tradecraft, cover, and noise budget. |
| `/black-wraith "<exfil paths>" [--target <host>] [--mission <mission-id>]` | `black-wraith` | Simulate exfil paths as analysis; check them against the noise budget. |
| `/blue-sentinel "<findings>" [--mission <mission-id>]` | `blue-sentinel` | Map findings to telemetry; one detector recommendation per gap. |
| `/blue-warden "<findings>" [--target <host>] [--mission <mission-id>]` | `blue-warden` | Audit hardening; verification checklist plus misconfiguration call-outs. |
| `/white-arbiter "<action>" [--mission <mission-id>]` | `white-arbiter` | Return the ROE verdict on an action; resolve red versus blue disputes. |
| `/white-auditor "<evidence>" [--mission <mission-id>]` | `white-auditor` | Score evidence by provenance; aggregate the evidence-strength verdict. |
| `/dark-purple "<scope>" [--target <host>] [--mission <mission-id>]` | `dark-purple` | Full loop: red findings to black pressure to blue detection to white verdict to report. |
