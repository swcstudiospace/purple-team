---
name: tempest-mission
description: >-
  Use when the operator starts, parks, resumes, pauses, or stops a mission:
  owns mission ids and the parked/resumable lifecycle.
---
# Tempest mission

Missions are the per-user session: the mission id is carried in skill text,
so no separate session store exists. Every reply that names a mission quotes
its id back.

## Start

Drive the `tempest_mission_start` MCP tool with a name, targets, and
operators — or directly:

```bash
curl -s -X POST http://127.0.0.1:3333/api/mission/start \
  -H 'Content-Type: application/json' \
  -d '{"name":"<name>","targets":[{"host":"<host>"}],"operators":["recon","scanner"]}'
```

Return the mission id first, then the parsed scope. If the scope is empty or
ambiguous, ask before starting.

## Park and resume

A parked mission keeps its id and its findings; nothing is deleted. Park by
pausing:

```bash
curl -s -X POST http://127.0.0.1:3333/api/mission/pause
```

Resume by id:

```bash
curl -s -X POST http://127.0.0.1:3333/api/mission/resume
```

List parked missions with `tempest_status` and offer each id back to the
operator. A mission id quoted from an earlier run always resolves here —
never mint a replacement id while the quoted one still exists.

## Stop

Drive `tempest_mission_stop`, or directly:

```bash
curl -s -X POST http://127.0.0.1:3333/api/mission/stop
```

Stopping ends the active mission; findings stay in the ledger and remain
reportable by mission id. If the backend is unreachable, say so in one line
and keep the mission parked under its id. The seat never opens a browser
panel; every step goes through the MCP tools or the loopback HTTP API.
