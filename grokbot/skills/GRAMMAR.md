# Shared slash-command grammar

Applies to every skill in this directory, including the seven hat skills
(`black-specter`, `black-wraith`, `blue-sentinel`, `blue-warden`,
`white-arbiter`, `white-auditor`, `dark-purple`). Per-skill files set the
order of operations; this file sets the language rules. When the two
conflict, the skill file wins for its own command.

## Quoted-argument parsing

Double quotes group words into one argument (`/blue-warden "missing
security headers" --target example.com` parses as scope `missing security
headers`, target `example.com`). Single quotes group the same way. An
unterminated quote is an error: quote the text back and ask for a retype
instead of guessing.

## `<target>` `<scope>` `<mission-id>` conventions

- `<target>` is a hostname or IP literal only (`example.com`, `10.0.0.5`).
  Reject anything with shell metacharacters before it reaches any tool.
- `<scope>` is the quoted question or artefact under review (a red plan, a
  finding id, an action, an evidence set). If it is empty, ask what to
  review and stop.
- `<mission-id>` is the per-user session handle, carried in skill text.
  Quote it back on every reply so a later message can resume or park the
  run. Never mint a replacement id while a quoted one still exists.

## Unknown-command fallback

If the first word after `/` matches no known slash, run nothing. Reply
with the three closest matches by name (for example, `/black-spectre`
suggests `/black-specter`, `/black-wraith`, `/blue-sentinel`) plus the
full `/tempest-help` list.

## Ack, progress, completion lifecycle

Long runs follow three beats. Acknowledge at once with the run or mission
id and the parsed arguments, before any backend call resolves. Then relay
short progress updates (phase, active operator, counts), quoting the
mission id each time. Close with a completion summary naming the mission
id, the verdict, and the report pointer (`/tempest-report <mission id>`).

## Parked and resumable via mission ids

A parked mission keeps its id and its findings; nothing is deleted. Park
by pausing, resume by quoting the id back, and offer parked ids whenever
the operator returns. If the backend is unreachable at any step, say so
in one line and keep the work parked under its id:

> Purple Team backend unreachable — start it with npm run server; this work is
> parked under its mission id and resumes when the backend answers.

Never present guesses as results. Seats never open a browser panel; every
step goes through the MCP tools or the loopback HTTP API.
