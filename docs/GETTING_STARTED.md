# Getting Started With Purple Team

Purple Team is a local offensive-security command center for authorized testing. It gives an AI coding agent or LLM-backed operator a UI, API, evidence store, mission model, and tool arsenal. Use it only on systems you own or have explicit written permission to test.

## Requirements

- Node.js 22.19 or newer
- npm
- git, if you want to update from upstream or contribute
- Optional local model runtime: Ollama, LM Studio, vLLM, or another OpenAI-compatible local server
- Optional security tools for deeper arsenal coverage; see [Arsenal Activation Plan](ARSENAL_ACTIVATION_PLAN.md)

## Install

From a clone:

```bash
git clone https://github.com/swcstudiospace/purple-team.git
cd purple-team
npm install
```

From an existing checkout:

```bash
npm install
```

## Configure A Model

You can run with a hosted provider key or a local model.

Interactive setup:

```bash
npm run setup
```

Hosted provider environment variables are supported:

```bash
export OPENROUTER_API_KEY=...
export VENICE_API_KEY=...
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
export DEEPSEEK_API_KEY=...
export NOVITA_API_KEY=...         # third-party hosted OpenAI-compatible API
export LITELLM_BASE_URL=http://localhost:4000/v1
export LITELLM_API_KEY=...        # only if your LiteLLM proxy requires one
```

Hosted providers receive the model id, prompts/context, generated output, and
request metadata needed to serve the request. For Novita, review the current
[privacy policy](https://novita.ai/legal/privacy-policy) and
[terms](https://novita.ai/legal/terms-of-service) before sending sensitive
target data; Purple Team does not independently certify it for sensitive workloads.

Local/offline example with Ollama:

```bash
ollama serve
ollama pull llama3
export TEMPEST_LOCAL_BASE_URL=http://localhost:11434/api
export TEMPEST_LOCAL_MODEL=llama3
export TEMPEST_LOCAL_API_KEY=...  # only if your local server requires one
```

Check current configuration:

```bash
npx t3mp3st status
npx t3mp3st models
npx t3mp3st test
```

## Start The War Room

```bash
npm run server
```

Open:

```text
http://127.0.0.1:3333/ui/
```

The server binds to `127.0.0.1` by default and does not require a token there. A non-loopback `T3MP3ST_HOST` (and Docker, which binds `0.0.0.0`) will not start until `T3MP3ST_BEARER_TOKEN` or `T3MP3ST_BEARER_TOKEN_FILE` is set. `/api` then requires that bearer.

If you need outbound test traffic to use a SOCKS5 proxy, configure it with `TEMPEST_PROXY_URL` or through the War Room settings. The expected form is:

```bash
export TEMPEST_PROXY_URL=socks5://127.0.0.1:9050
```

## First Safe Run

Use a target you control, a local lab, or a CTF service.

1. Open the War Room.
2. Run the preflight view and confirm the API is healthy.
3. Sync or inspect arsenal status so missing tools are visible.
4. Define the target and rules of engagement before any active probing.
5. Start with a passive or local-safe plan.
6. Approve only the active or networked operations that are inside scope.
7. Save evidence before promoting a finding.
8. Retest before reporting.

If you are only evaluating the app, use the built-in safe checks:

```bash
npm run doctor
npm run field:drill
npm run arsenal:smoke
npm run prompt:audit
```

## CLI Basics

```bash
npx t3mp3st              # interactive mode
npx t3mp3st setup        # setup wizard
npx t3mp3st status       # config status
npx t3mp3st models       # available models for the selected provider
npx t3mp3st test         # test the selected LLM connection
```

The interactive CLI can start an operation, spawn operators, add targets, create missions, chat with the configured model, and generate a report from collected findings.

## Updating

Preview an update:

```bash
npm run update:dry
```

Interactive update from upstream:

```bash
npm run update
```

Hard reset to upstream is opt-in:

```bash
npm run update:hard
```

The updater protects local secrets and run artifacts listed in `scripts/update-protected.txt`.

## Inference Providers

Purple Team accepts hosted keys, local endpoints, and plan sign-ins. `POST
`/api/models`` lists models for a provider; mission/general/admiral routes
take a `provider` field.

- ChatGPT Plan: connect with the `openai` PKCE flow in Settings — no API
  key; subscription OAuth is the only auth. See [API
  Reference](API_REFERENCE.md#subscription-oauth-chatgpt-plan-claudegrok-plans).
- Cursor Plan: install the `cursor-agent` CLI, sign in, then connect — the
  CLI's own login is used, keyless.
- Claude Pro/Max: sign in through Settings with the Claude PKCE flow — open the
  authorize URL, then paste the callback code back. Tokens stay on the server and
  ride the `anthropic` provider (subscription usage, not metered API credits). The
  local `claude` CLI connector still works separately under Local agents.
- Grok plans: sign in through Settings (X device flow); tokens stay on the server.
- OpenRouter and other hosted providers: set the provider key as shown in
  Configure A Model above.

## The White/Red UI

The War Room at `/ui/` is compartmentalized: white pages (overview, mission,
evidence, engagements, settings, about) for planning and review, red pages
(operators, arsenal, terminal, range) for active operations — all inside one
shared shell. Open `http://127.0.0.1:3333/ui/` after `npm run server`.

## Dark Purple Teams

Missions run on three spawnable team archetypes — `black` (offense), `blue`
(detection), `white` (ROE/oversight) — each with its own arsenal grant
table (`GET /api/teams/tool-grants`). Purple is the orchestrator that
correlates the three outputs into one posture ledger via `POST
/api/teams/purple/synthesize`. See [API
Reference](API_REFERENCE.md#dark-purple-teams).

## Grok Bot Quickstart

Five team seats (commander, red, black, blue, white) drive the loopback
backend through saved skills:

1. Start the backend: `npm run server` (gateway default
   `http://127.0.0.1:3333`).
2. Each seat runs `/tempest bootstrap` to register its seat id and check
   gateway reachability.
3. Talk to COMMANDER; it tasks the team seats and consolidates evidence.
   Seven saved skills cover bootstrap, run, mission, operators, status,
   report, and memory — see `grokbot/skills/index.json` and [MCP
   Guide](MCP_GUIDE.md#tempest-bot-proxy-tools-tempest_).

## Common Problems

| Symptom | Check |
|---|---|
| UI does not load | Confirm `npm run server` is still running and open `http://127.0.0.1:3333/ui/` |
| LLM calls fail | Run `npx t3mp3st status` and `npx t3mp3st test`; check provider key or local model URL |
| Arsenal tools show missing | Install the relevant tools from [Arsenal Activation Plan](ARSENAL_ACTIVATION_PLAN.md) |
| Active tool call is refused | Confirm the target is authorized and inside the active scope receipt |
| Update wants to change local files | Run `npm run update:dry` first and inspect the plan |
