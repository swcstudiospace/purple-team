---
name: tempest-report
description: >-
  Use when the operator types /tempest-report: exports the engagement report
  for a mission id.
---
# Tempest report

## /tempest-report — export

```
/tempest-report [<mission id>]
```

Drive the `tempest_report` MCP tool with the mission id, or directly:

```bash
curl -s 'http://127.0.0.1:3333/api/mission/report?missionId=<mission-id>'
```

With no id, report the active mission; with an id, report that mission even
if it is parked or stopped. Findings stay in the ledger after a stop, so a
closed mission still reports.

Present the report as: mission id, scope, findings ordered by severity with
evidence pointers, detection gaps from the blue seat, verdict notes from the
white seat, and prioritized next steps. For the purple synthesis view, drive
`tempest_purple_synthesize` (red findings plus blue detection gaps into one
posture ledger):

```bash
curl -s -X POST http://127.0.0.1:3333/api/teams/purple/synthesize \
  -H 'Content-Type: application/json' \
  -d '{"findings":[],"detections":[]}'
```

If the mission has no findings, say so instead of padding. If the backend is
unreachable, reply with the one-line degraded text and keep the mission id
for retry. The seat never opens a browser panel; every step goes through the
MCP tools or the loopback HTTP API.
