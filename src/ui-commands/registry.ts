export type AgentId = 'red' | 'blue' | 'white' | 'black' | 'purple' | 'system';

export interface ArgSpec {
  name: string;
  required: boolean;
  hint: string;
  /** Inline suggestion for composer ghost-text and the slash palette hint area. */
  example?: string;
}

export interface CommandSpec {
  /** Name without the slash, e.g. 'coverage'. */
  name: string;
  aliases: readonly string[];
  agent: AgentId;
  summary: string;
  args: readonly ArgSpec[];
  /** null = local help only. */
  route: { method: 'GET' | 'POST'; path: string } | null;
  /** true = requires an explicit second Enter before executing. */
  confirm?: boolean;
}

const JSON_ARRAY = 'JSON array';
const JSON_OBJECT = 'JSON object';

export const COMMANDS: readonly CommandSpec[] = [
  {
    name: 'coverage',
    aliases: ['cov'],
    agent: 'blue',
    summary: 'Run the blue-team detection coverage stage over staged artifacts and findings.',
    args: [
      { name: 'runId', required: true, hint: 'run id' },
      { name: 'missionId', required: true, hint: 'mission id' },
      {
        name: 'family',
        required: true,
        hint: 'web_api | cloud_infra | code_supply_chain | crypto_secrets | reporting_remediation | ai_red_team | agent_warfare',
      },
      { name: 'artifactIds', required: true, hint: `${JSON_ARRAY} of artifact id strings`, example: '["A-1","A-2"]' },
      { name: 'artifactBytes', required: true, hint: 'string of the artifact bytes actually read' },
      { name: 'findings', required: true, hint: `${JSON_ARRAY} of coverage findings` },
      { name: 'telemetry', required: true, hint: `${JSON_ARRAY} of telemetry declarations` },
      { name: 'observedByFinding', required: false, hint: `${JSON_OBJECT} of per-finding artifact bindings` },
    ],
    route: { method: 'POST', path: '/api/teams/blue/coverage' },
  },
  {
    name: 'workflow',
    aliases: ['wf', 'black'],
    agent: 'black',
    summary: 'Run the black-team analysis workflow (exfil cost, noise budget, OPSEC review). Analysis only.',
    args: [
      { name: 'actions', required: false, hint: `${JSON_ARRAY} of action strings`, example: '["analysis"]' },
      { name: 'paths', required: false, hint: `${JSON_ARRAY} of exfil paths`, example: '["/tmp/creds.json",".env"]' },
      { name: 'egress', required: false, hint: `${JSON_ARRAY} of egress strings`, example: '["https://example.com/collect"]' },
      { name: 'routeEvidence', required: false, hint: `${JSON_ARRAY} of route evidence entries` },
      {
        name: 'requestKind',
        required: false,
        hint: 'analysis | destructive-concealment | live-probe | live-bulk-exfil | verify-route',
      },
    ],
    route: { method: 'POST', path: '/api/teams/black/workflow' },
  },
  {
    name: 'stage',
    aliases: ['roe'],
    agent: 'white',
    summary: 'Stage a rules-of-engagement audit with its proposed actions.',
    args: [
      {
        name: 'roeText',
        required: true,
        hint: 'rules-of-engagement text',
        example: 'Read-only recon plus exploit attempts; no destructive payloads; stay in declared scope',
      },
      { name: 'actions', required: true, hint: `${JSON_ARRAY} of proposed actions` },
      { name: 'meta', required: false, hint: `${JSON_OBJECT} of stage metadata` },
    ],
    route: { method: 'POST', path: '/api/teams/white/stage' },
  },
  {
    name: 'synthesize',
    aliases: ['synth'],
    agent: 'purple',
    summary: 'Synthesize findings, detections, and verdicts into a purple-team summary.',
    args: [
      { name: 'findings', required: true, hint: `${JSON_ARRAY} of findings`, example: '["F-1","F-2"]' },
      { name: 'detections', required: true, hint: `${JSON_ARRAY} of detections`, example: '["D-1","D-2"]' },
      { name: 'verdicts', required: true, hint: `${JSON_ARRAY} of verdicts`, example: '["confirmed","plausible"]' },
      {
        name: 'verdictsByFinding',
        required: false,
        hint: `${JSON_OBJECT} of findingId to verdict`,
        example: '{"F-1":"confirmed"}',
      },
    ],
    route: { method: 'POST', path: '/api/teams/purple/synthesize' },
  },
  {
    name: 'hunt',
    aliases: ['start', 'attack'],
    agent: 'red',
    summary: 'Start a structured red-team mission against targets with the given operator roles.',
    args: [
      { name: 'objective', required: true, hint: 'mission objective', example: 'Find auth bypasses in the login flow and report detection gaps' },
      { name: 'operators', required: true, hint: 'comma-separated operator roles', example: 'recon,exploiter' },
      { name: 'targets', required: true, hint: 'comma-separated targets', example: 'api.example.com,10.0.0.5' },
      { name: 'repoUrl', required: false, hint: 'github.com owner/repo[/tree/ref/subpath] URL' },
      { name: 'name', required: false, hint: 'mission name' },
    ],
    route: { method: 'POST', path: '/api/mission/start' },
  },
  {
    name: 'recon',
    aliases: ['scan'],
    agent: 'red',
    summary: 'Run DNS and port reconnaissance against a single target host.',
    args: [
      { name: 'target', required: true, hint: 'host or URL to scan' },
      { name: 'scan_type', required: false, hint: 'quick | standard | full | stealth (default quick)' },
    ],
    route: { method: 'POST', path: '/api/tools/recon' },
  },
  {
    name: 'findings',
    aliases: ['finds'],
    agent: 'system',
    summary: 'List the findings ledger, optionally filtered by mission or operation.',
    args: [
      { name: 'missionId', required: false, hint: 'filter by mission id' },
      { name: 'operationId', required: false, hint: 'filter by operation id' },
    ],
    route: { method: 'GET', path: '/api/findings' },
  },
  {
    name: 'mission',
    aliases: ['status'],
    agent: 'system',
    summary: 'Show the status of the active mission, its progress, and tasks.',
    args: [],
    route: { method: 'GET', path: '/api/mission/status' },
  },
  {
    name: 'agents',
    aliases: ['detect'],
    agent: 'system',
    summary: 'Detect which local agents are installed, authenticated, and ready.',
    args: [],
    route: { method: 'GET', path: '/api/agents/local/detect' },
  },
  {
    name: 'stop',
    aliases: ['abort'],
    agent: 'system',
    summary: 'Stop the active mission. Requires a second Enter to confirm.',
    args: [],
    route: { method: 'POST', path: '/api/mission/stop' },
    confirm: true,
  },
  {
    name: 'tools',
    aliases: ['catalog'],
    agent: 'system',
    summary: 'List registered 4-Hat and shared utility tools, optionally filtered by hat.',
    args: [
      { name: 'hat', required: false, hint: 'red | blue | white | black | shared (optional filter)' },
    ],
    route: { method: 'GET', path: '/api/teams/tools' },
  },
  {
    name: 'tool',
    aliases: ['run-tool'],
    agent: 'purple',
    summary: 'Run a registered 4-Hat or shared utility tool by id.',
    args: [
      { name: 'toolId', required: true, hint: 'tool id from /tools' },
      { name: 'input', required: false, hint: `${JSON_OBJECT} of tool input`, example: '{"target":"api.example.com"}' },
    ],
    route: { method: 'POST', path: '/api/teams/tools/run' },
  },
  {
    name: 'skills',
    aliases: ['skillset'],
    agent: 'system',
    summary: 'List composable multi-Hat skills, optionally filtered by hat.',
    args: [
      { name: 'hat', required: false, hint: 'red | blue | white | black (optional filter)' },
    ],
    route: { method: 'GET', path: '/api/teams/skills' },
  },
  {
    name: 'skill',
    aliases: ['run-skill'],
    agent: 'purple',
    summary: 'Run a composable multi-Hat skill pipeline by id.',
    args: [
      { name: 'skillId', required: true, hint: 'skill id from /skills' },
      { name: 'params', required: false, hint: `${JSON_OBJECT} of skill params`, example: '{"depth":"quick"}' },
    ],
    route: { method: 'POST', path: '/api/teams/skills/run' },
  },
  {
    name: 'help',
    aliases: ['?', 'commands'],
    agent: 'system',
    summary: 'List every slash command with its aliases, arguments, and summary.',
    args: [],
    route: null,
  },
];
