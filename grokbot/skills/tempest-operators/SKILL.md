---
name: tempest-operators
description: >-
  Use when the operator types /tempest-agents or tasks a seat: lists operators
  and dispatches work to one operator id.
---
# Tempest operators

## /tempest-agents — list

Drive the `tempest_operators_list` MCP tool, or directly:

```bash
curl -s http://127.0.0.1:3333/api/operators/list
```

Present each operator as one line: id, archetype, state. If no mission is
active the list is empty — say that plainly and offer to start one rather
than inventing operators.

## Task one operator

Drive the `tempest_operator_task` MCP tool with the operator id, a task name,
and a task description — or directly:

```bash
curl -s -X POST http://127.0.0.1:3333/api/operators/<operator-id>/task \
  -H 'Content-Type: application/json' \
  -d '{"taskName":"<name>","taskDescription":"<what to do>","phase":"recon"}'
```

Rules:

- One operator per call. A request naming two seats becomes two calls, and
  the reply says which task went where.
- New seats spawn only inside an active mission. Ask for the mission id
  first when there is none.
- Match the task to the seat's doctrine: strike work to red, cover reviews
  to black, detection questions to blue, verdicts to white. COMMANDER
  consolidates; it does not reassign a seat's answer to another seat.

If the backend is unreachable, say so in one line and keep the task text so
it can be dispatched when the backend answers. The seat never opens a
browser panel; every step goes through the MCP tools or the loopback HTTP
API.
