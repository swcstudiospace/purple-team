#!/usr/bin/env node
/**
 * T3MP3ST CLI
 *
 * Command-line interface for T3MP3ST operations.
 */

import { pathToFileURL } from 'node:url';

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import Table from 'cli-table3';
import gradient from 'gradient-string';
import figlet from 'figlet';

import {
  createAutoTempest,
  createTestTempest,
  createStealthOperation,
  createAggressiveOperation,
  getBanner,
  type Tempest,
  type OperatorArchetype,
} from './index.js';

import {
  config,
  hasApiKey,
  setApiKey,
  getConfiguredProviders,
} from './config/index.js';

import { LLMBackbone } from './llm/index.js';
import { resolveProviderModels, type ProviderModelList } from './config/provider-models.js';
import type { LLMProvider } from './types/index.js';

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

function showBanner(): void {
  try {
    const text = figlet.textSync('PURPLE TEAM', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
    });
    console.log(gradient.pastel.multiline(text));
  } catch {
    console.log(chalk.cyan(getBanner()));
  }
  console.log(chalk.gray('  Chat Panel + CLI share the same hunt.\n'));
}

function showBox(title: string, content: string, borderColor: string = 'cyan'): void {
  console.log(
    boxen(content, {
      title,
      titleAlignment: 'center',
      padding: 1,
      margin: { top: 0, bottom: 1, left: 1, right: 1 },
      borderStyle: 'round',
      borderColor: borderColor as any,
    })
  );
}

function showSuccess(message: string): void {
  console.log(chalk.green('✓ ') + message);
}

function showError(message: string): void {
  console.log(chalk.red('✗ ') + message);
}

function showInfo(message: string): void {
  console.log(chalk.blue('ℹ ') + message);
}

function showWarning(message: string): void {
  console.log(chalk.yellow('⚠ ') + message);
}

// =============================================================================
// STATUS DISPLAY
// =============================================================================

function displayStatus(tempest: Tempest): void {
  const status = tempest.command.getStatus();

  console.log('');
  console.log(chalk.bold.cyan('═══ OPERATION STATUS ═══'));
  console.log('');

  // Operation Info
  console.log(chalk.bold('Operation:'), status.name);
  console.log(chalk.bold('Status:'), status.running
    ? (status.paused ? chalk.yellow('PAUSED') : chalk.green('RUNNING'))
    : chalk.gray('STOPPED'));
  console.log(chalk.bold('Tick Count:'), status.tickCount);
  console.log('');

  // Operators Table
  const opTable = new Table({
    head: [
      chalk.cyan('Status'),
      chalk.cyan('Count'),
    ],
    style: { head: [], border: [] },
  });

  opTable.push(
    ['Available', chalk.green(status.operators.available.toString())],
    ['Busy', chalk.yellow(status.operators.busy.toString())],
    ['Cooldown', chalk.blue(status.operators.cooldown.toString())],
    ['Burned', chalk.red(status.operators.burned.toString())],
    [chalk.bold('Total'), chalk.bold(status.operators.total.toString())],
  );

  console.log(chalk.bold('Operators:'));
  console.log(opTable.toString());
  console.log('');

  // Findings Summary
  const findingsTable = new Table({
    head: [
      chalk.cyan('Severity'),
      chalk.cyan('Count'),
    ],
    style: { head: [], border: [] },
  });

  findingsTable.push(
    [chalk.red('Critical'), status.vault.bySeverity.critical.toString()],
    [chalk.magenta('High'), status.vault.bySeverity.high.toString()],
    [chalk.yellow('Medium'), status.vault.bySeverity.medium.toString()],
    [chalk.blue('Low'), status.vault.bySeverity.low.toString()],
    [chalk.gray('Info'), status.vault.bySeverity.info.toString()],
  );

  console.log(chalk.bold('Findings:'));
  console.log(findingsTable.toString());
  console.log('');

  // OPSEC Status
  const opsecColor = status.opsec.riskLevel === 'critical' ? chalk.red :
    status.opsec.riskLevel === 'high' ? chalk.yellow :
    status.opsec.riskLevel === 'medium' ? chalk.blue : chalk.green;

  console.log(chalk.bold('OPSEC:'), opsecColor(status.opsec.riskLevel.toUpperCase()));
  console.log(chalk.bold('Detections:'), `${status.opsec.activeDetections}/${status.opsec.totalDetections}`);

  if (status.opsec.abortRecommended) {
    console.log(chalk.red.bold('⚠ ABORT RECOMMENDED'));
  }

  console.log('');
}

// =============================================================================
// INTERACTIVE MODE
// =============================================================================

async function interactiveMode(): Promise<void> {
  showBanner();

  // Check for API keys
  const providers = getConfiguredProviders().filter(p => p !== 'mock');

  if (providers.length === 0) {
    showBox(
      'Setup Required',
      `No API keys configured. Please run setup first:

${chalk.cyan('npx t3mp3st setup')}

Or set environment variables:
${chalk.gray('OPENROUTER_API_KEY=your-key-here')}`,
      'yellow'
    );

    const { runSetup } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'runSetup',
        message: 'Would you like to run setup now?',
        default: true,
      },
    ]);

    if (runSetup) {
      // Run setup
      const { execSync } = await import('child_process');
      execSync('npx tsx src/setup.ts', { stdio: 'inherit' });
    }
    return;
  }

  // Welcome message
  showBox(
    'Welcome to Purple Team',
    `Configured providers: ${providers.map(p => chalk.cyan(p)).join(', ')}
Default: ${chalk.cyan(config.get('defaultProvider'))} / ${chalk.cyan(config.get('defaultModel'))}`,
    'cyan'
  );

  // Main menu loop
  let running = true;
  let tempest: Tempest | null = null;

  while (running) {
    const choices = [
      { name: 'Purple Team a target', value: 'purple' },
      { name: '🚀 Start New Operation', value: 'new' },
    ];

    if (tempest) {
      choices.push(
        { name: '📊 View Status', value: 'status' },
        { name: '👤 Spawn Operator', value: 'spawn' },
        { name: '🎯 Add Target', value: 'target' },
        { name: '📋 Create Mission', value: 'mission' },
        { name: '💬 Chat with AI', value: 'chat' },
        { name: '📝 Generate Report', value: 'report' },
        { name: '⏹️  Stop Operation', value: 'stop' },
      );
    }

    choices.push(
      { name: '⚙️  Settings', value: 'settings' },
      { name: '🚪 Exit', value: 'exit' },
    );

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: tempest ? `[${tempest.command.name}] What would you like to do?` : 'What would you like to do?',
        choices,
      },
    ]);

    try {
      switch (action) {
        case 'purple':
          await purpleTeamTarget();
          break;
        case 'new':
          tempest = await startNewOperation();
          break;
        case 'status':
          if (tempest) displayStatus(tempest);
          break;
        case 'spawn':
          if (tempest) await spawnOperator(tempest);
          break;
        case 'target':
          if (tempest) await addTarget(tempest);
          break;
        case 'mission':
          if (tempest) await createMission(tempest);
          break;
        case 'chat':
          if (tempest) await chatWithAI(tempest);
          break;
        case 'report':
          if (tempest) await generateReport(tempest);
          break;
        case 'stop':
          if (tempest) {
            tempest.command.stop();
            showSuccess('Operation stopped');
            tempest = null;
          }
          break;
        case 'settings':
          await openSettings();
          break;
        case 'exit':
          if (tempest) {
            const { confirmExit } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirmExit',
                message: 'Operation is running. Are you sure you want to exit?',
                default: false,
              },
            ]);
            if (!confirmExit) continue;
            tempest.command.stop();
          }
          running = false;
          break;
      }
    } catch (error) {
      showError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(chalk.gray('\nGoodbye!\n'));
}

async function startNewOperation(): Promise<Tempest> {
  const { name, type } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Operation name:',
      default: `Operation ${Date.now().toString(36).toUpperCase()}`,
    },
    {
      type: 'list',
      name: 'type',
      message: 'Operation type:',
      choices: [
        { name: 'Auto (use configured defaults)', value: 'auto' },
        { name: 'Stealth (minimal detection)', value: 'stealth' },
        { name: 'Aggressive (maximum speed)', value: 'aggressive' },
        { name: 'Test (mock LLM)', value: 'test' },
      ],
    },
  ]);

  const spinner = ora('Initializing operation...').start();

  let tempest: Tempest;

  switch (type) {
    case 'stealth':
      tempest = createStealthOperation(name);
      break;
    case 'aggressive':
      tempest = createAggressiveOperation(name);
      break;
    case 'test':
      tempest = createTestTempest(name);
      break;
    default:
      tempest = createAutoTempest(name);
  }

  tempest.command.start();
  spinner.succeed(`Operation "${name}" started!`);

  displayStatus(tempest);

  return tempest;
}

async function spawnOperator(tempest: Tempest): Promise<void> {
  const archetypes: OperatorArchetype[] = [
    'recon', 'scanner', 'exploiter', 'infiltrator',
    'exfiltrator', 'ghost', 'coordinator', 'analyst',
    'black', 'blue', 'white',
    'specter', 'wraith', 'sentinel', 'warden', 'arbiter', 'auditor',
  ];

  const { archetype, callsign } = await inquirer.prompt([
    {
      type: 'list',
      name: 'archetype',
      message: 'Select operator archetype:',
      choices: archetypes.map(a => ({
        name: `${a.charAt(0).toUpperCase() + a.slice(1)}`,
        value: a,
      })),
    },
    {
      type: 'input',
      name: 'callsign',
      message: 'Operator callsign:',
      default: (answers: { archetype: string }) =>
        `${answers.archetype.charAt(0).toUpperCase() + answers.archetype.slice(1)}-${tempest.cell.getAllOperators().length + 1}`,
    },
  ]);

  const operator = tempest.command.spawnOperator(callsign, archetype);
  showSuccess(`Operator ${callsign} (${archetype}) spawned!`);
  showInfo(`ID: ${operator.id}`);
}

async function addTarget(tempest: Tempest): Promise<void> {
  const { address, type, zone } = await inquirer.prompt([
    {
      type: 'input',
      name: 'address',
      message: 'Target address (URL or IP):',
      validate: (input: string) => input.length > 0 || 'Address is required',
    },
    {
      type: 'list',
      name: 'type',
      message: 'Target type:',
      choices: [
        'web_application',
        'api',
        'network',
        'host',
        'database',
        'cloud',
      ],
    },
    {
      type: 'list',
      name: 'zone',
      message: 'Target zone:',
      choices: ['external', 'dmz', 'internal', 'restricted'],
    },
  ]);

  const target = tempest.targetEnv.addTarget({
    name: address,
    type,
    zone,
    address,
  });

  showSuccess(`Target "${address}" added!`);
  showInfo(`ID: ${target.id}`);
}

async function createMission(tempest: Tempest): Promise<void> {
  const { name, objectives } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Mission name:',
      default: 'Primary Mission',
    },
    {
      type: 'input',
      name: 'objectives',
      message: 'Objectives (comma-separated):',
      default: 'Enumerate attack surface, Identify vulnerabilities, Document findings',
    },
  ]);

  const mission = tempest.mission.createMission({
    name,
    objectives: objectives.split(',').map((o: string) => o.trim()),
  });

  tempest.mission.startMission(mission.id);

  showSuccess(`Mission "${name}" created and started!`);
  showInfo(`ID: ${mission.id}`);
}

async function chatWithAI(tempest: Tempest): Promise<void> {
  showInfo('Chat mode - type "exit" to return to menu\n');

  let chatting = true;

  while (chatting) {
    const { message } = await inquirer.prompt([
      {
        type: 'input',
        name: 'message',
        message: chalk.cyan('You:'),
        validate: (input: string) => input.length > 0 || 'Enter a message',
      },
    ]);

    if (message.toLowerCase() === 'exit') {
      chatting = false;
      continue;
    }

    const spinner = ora('Thinking...').start();

    try {
      const response = await tempest.llm.prompt(message);
      spinner.stop();
      console.log(chalk.green('AI:'), response);
      console.log('');
    } catch (error) {
      spinner.fail('Error');
      showError(`${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function generateReport(tempest: Tempest): Promise<void> {
  const mission = tempest.mission.getActiveMission();

  if (!mission) {
    // Create a temporary mission for report
    const tempMission = tempest.mission.createMission({
      name: 'Ad-hoc Report',
      objectives: ['Generate findings report'],
    });
    tempest.mission.startMission(tempMission.id);
  }

  try {
    const report = tempest.command.generateReport();
    console.log('');
    console.log(chalk.bold.cyan('═══ ENGAGEMENT REPORT ═══'));
    console.log('');
    console.log(report);
  } catch (error) {
    showWarning('No findings to report yet.');
  }
}

/** Live model list for the provider's configured key. Never throws; `unavailable` carries the note to show. */
async function liveModelListing(provider: LLMProvider): Promise<ProviderModelList> {
  let llm: { baseUrl?: string; apiKey?: string; authType?: 'api-key' | 'oauth' } = {};
  try {
    llm = config.getLLMConfig(provider);
  } catch {
    // No remote config for this provider: the resolver reports it as unavailable.
  }
  return resolveProviderModels(provider, { baseUrl: llm.baseUrl, apiKey: llm.apiKey, authType: llm.authType });
}

async function openSettings(): Promise<void> {
  const { setting } = await inquirer.prompt([
    {
      type: 'list',
      name: 'setting',
      message: 'Settings:',
      choices: [
        { name: 'View current configuration', value: 'view' },
        { name: 'Change default provider', value: 'provider' },
        { name: 'Change default model', value: 'model' },
        { name: 'Add/update API key', value: 'apikey' },
        { name: 'Back', value: 'back' },
      ],
    },
  ]);

  switch (setting) {
    case 'view':
      const settings = config.getAll();
      console.log('');
      console.log(chalk.bold('Current Configuration:'));
      console.log(chalk.cyan('  Provider:'), settings.defaultProvider);
      console.log(chalk.cyan('  Model:'), settings.defaultModel);
      console.log(chalk.cyan('  OpenRouter:'), hasApiKey('openrouter') ? chalk.green('configured') : chalk.red('not set'));
      console.log(chalk.cyan('  Venice:'), hasApiKey('venice') ? chalk.green('configured') : chalk.red('not set'));
      console.log(chalk.cyan('  Anthropic:'), hasApiKey('anthropic') ? chalk.green('configured') : chalk.red('not set'));
      console.log(chalk.cyan('  OpenAI:'), hasApiKey('openai') ? chalk.green('configured') : chalk.red('not set'));
      console.log(chalk.cyan('  DeepSeek:'), hasApiKey('deepseek') ? chalk.green('configured') : chalk.red('not set'));
      console.log(chalk.cyan('  HuggingFace:'), hasApiKey('huggingface') ? chalk.green('configured') : chalk.red('not set'));
      console.log('');
      break;

    case 'provider':
      const providers = getConfiguredProviders().filter(p => p !== 'mock');
      if (providers.length === 0) {
        showWarning('No API keys configured');
        break;
      }
      const { provider } = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: 'Select default provider:',
          choices: providers,
          default: config.get('defaultProvider'),
        },
      ]);
      config.setDefaultProvider(provider);
      showSuccess(`Default provider set to: ${provider}`);
      break;

    case 'model': {
      const currentProvider = config.get('defaultProvider');
      const listing = await liveModelListing(currentProvider);
      if (listing.source === 'unavailable') {
        showWarning(listing.note ?? `No models available for ${currentProvider}`);
        break;
      }
      if (listing.note) showWarning(listing.note);
      const { selectedModel } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedModel',
          message: 'Select default model:',
          choices: listing.models.map(m => ({ name: m.id, value: m.id })),
          default: config.get('defaultModel'),
        },
      ]);
      config.setDefaultModel(currentProvider, selectedModel);
      showSuccess(`Default model set to: ${selectedModel}`);
      break;
    }

    case 'apikey':
      const { keyProvider } = await inquirer.prompt([
        {
          type: 'list',
          name: 'keyProvider',
          message: 'Which provider?',
          choices: ['openrouter', 'venice', 'anthropic', 'openai', 'deepseek', 'huggingface'],
        },
      ]);
      const { apiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: `Enter ${keyProvider} API key:`,
          mask: '*',
        },
      ]);
      if (apiKey) {
        setApiKey(keyProvider, apiKey);
        showSuccess(`${keyProvider} API key saved!`);
      }
      break;
  }
}


const HAT_OPERATORS = {
  Red: ['scanner', 'recon', 'exploiter'],
  Blue: ['blue', 'sentinel'],
  White: ['white', 'auditor'],
  Black: ['black', 'specter'],
} as const;

type HatName = keyof typeof HAT_OPERATORS;


/** Structured mission body. Never includes the role id `red`. */
export function buildPurpleTeamPayload(input: {
  objective: string;
  target: string;
  hats: readonly HatName[];
  provider: string;
  model: string;
}): {
  objective: string;
  operators: string[];
  targetContext: { kind: 'artifacts' };
  repoUrl?: string;
  repoPath?: string;
  provider: string;
  model: string;
} {
  const operators = input.hats.flatMap(hat => [...HAT_OPERATORS[hat]]);
  const target = input.target.trim();
  const github = /^https?:\/\//i.test(target) || /github\.com\//i.test(target) || target.startsWith('github.com/');
  const repoUrl = github
    ? (target.startsWith('github.com/') ? `https://${target}` : target)
    : undefined;
  return {
    objective: input.objective.trim(),
    operators,
    targetContext: { kind: 'artifacts' },
    ...(repoUrl !== undefined ? { repoUrl } : { repoPath: target }),
    provider: input.provider,
    model: input.model,
  };
}

async function purpleTeamTarget(): Promise<void> {
  const defaultProvider = String(config.get('defaultProvider') ?? '');
  const defaultModel = String(config.get('defaultModel') ?? '');
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'objective',
      message: 'Objective:',
      validate: (value: string) => value.trim() !== '' || 'Objective is required',
    },
    {
      type: 'input',
      name: 'target',
      message: 'Target (GitHub URL or local folder path):',
      validate: (value: string) => value.trim() !== '' || 'Target is required',
    },
    {
      type: 'checkbox',
      name: 'hats',
      message: 'Hats:',
      choices: (Object.keys(HAT_OPERATORS) as HatName[]).map(hat => ({
        name: `${hat} (${HAT_OPERATORS[hat].join(', ')})`,
        value: hat,
      })),
      validate: (value: readonly HatName[]) => value.length > 0 || 'Select at least one hat',
    },
    {
      type: 'input',
      name: 'provider',
      message: 'Provider:',
      default: defaultProvider,
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model:',
      default: defaultModel,
    },
  ]);

  const payload = buildPurpleTeamPayload(answers);
  const portRaw = process.env.T3MP3ST_PORT;
  const portTrimmed = typeof portRaw === 'string' ? portRaw.trim() : '';
  const port = portTrimmed !== '' ? portTrimmed : '3333';
  const url = `http://127.0.0.1:${port}/api/mission/start`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    showError('Purple Team server is not running.');
    console.log(`Start it with: ${chalk.cyan('npm run server')}`);
    console.log(chalk.gray('Payload that would have been sent:'));
    console.log(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text === '' ? null : JSON.parse(text);
  } catch {
    body = text;
  }

  const record = body !== null && typeof body === 'object' ? body : null;
  const errorField = record !== null && 'error' in record ? record.error : undefined;
  if (!response.ok || (typeof errorField === 'string' && errorField.trim() !== '')) {
    const message = typeof errorField === 'string' && errorField.trim() !== ''
      ? errorField
      : text || `HTTP ${response.status}`;
    showError(message);
    process.exit(1);
  }

  const runIdField = record !== null && 'runId' in record ? record.runId : undefined;
  const operatorsField = record !== null && 'operators' in record ? record.operators : undefined;
  const runId = typeof runIdField === 'string' ? runIdField : '(none)';
  const spawned = Array.isArray(operatorsField)
    ? operatorsField.map(op => {
        if (op !== null && typeof op === 'object' && 'archetype' in op) {
          const callsign = 'callsign' in op && typeof op.callsign === 'string'
            ? op.callsign
            : 'id' in op ? String(op.id) : '';
          return `${callsign} (${String(op.archetype)})`;
        }
        return String(op);
      })
    : payload.operators;
  showSuccess(`Run id: ${runId}`);
  showInfo(`Operators spawned: ${spawned.join(', ')}`);
  showInfo(`Watch ${chalk.cyan(`http://127.0.0.1:${port}/app/#chat`)}`);

  // Poll status until mission completes so the CLI command runs for the full duration
  // (visible phases + progress), then fetch and print the report (ensures after run
  // it calls generateReport-equivalent on server and prints). Matches UI launch flow.
  const statusUrl = `http://127.0.0.1:${port}/api/mission/status`;
  const reportUrl = `http://127.0.0.1:${port}/api/mission/report`;
  const maxWaitMs = 10 * 60 * 1000;
  const pollIntervalMs = 2000;
  const started = Date.now();
  let done = false;
  while (!done && Date.now() - started < maxWaitMs) {
    try {
      const sres = await fetch(statusUrl);
      if (sres.ok) {
        const sbodyRaw: unknown = await sres.json();
        const sbody = sbodyRaw as { active?: boolean; mission?: { currentPhase?: string; progress?: number } | null; progress?: unknown };
        const active = !!sbody.active;
        const m = sbody.mission;
        if (m) {
          showInfo(`Phase: ${m.currentPhase || 'unknown'}  progress: ${m.progress ?? 0}%`);
        } else if (sbody.progress) {
          showInfo(`Progress: ${JSON.stringify(sbody.progress)}`);
        }
        if (!active) {
          done = true;
        }
      }
    } catch {
      // server may still be starting
    }
    if (!done) {
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
  }

  // Now call report (server side generateReport) and print
  try {
    const rres = await fetch(reportUrl);
    if (rres.ok) {
      const rbodyRaw: unknown = await rres.json();
      const rbody = rbodyRaw as { report?: string };
      if (rbody.report) {
        console.log('');
        console.log(chalk.bold.cyan('═══ ENGAGEMENT REPORT ═══'));
        console.log('');
        console.log(rbody.report);
      }
    } else {
      showWarning('Report not yet available (mission may have no findings).');
    }
  } catch {
    showWarning('Could not retrieve final report.');
  }
}

// =============================================================================
// CLI COMMANDS
// =============================================================================

export const program = new Command();

program
  .name('t3mp3st')
  .description('Purple Team: a four-hat educational vulnerability AI (Red, Blue, White, Black)')
  .version('1.0.0');

program
  .command('interactive', { isDefault: true })
  .description('Start interactive mode')
  .action(interactiveMode);

program
  .command('setup')
  .description('Run the setup wizard')
  .action(async () => {
    const { execSync } = await import('child_process');
    try {
      execSync('npx tsx src/setup.ts', { stdio: 'inherit', cwd: process.cwd() });
    } catch {
      // Setup script handles its own errors
    }
  });

program
  .command('status')
  .description('Show current configuration status')
  .action(() => {
    showBanner();
    const settings = config.getAll();

    console.log(chalk.bold('Configuration Status:\n'));

    const table = new Table({
      style: { head: [], border: [] },
    });

    table.push(
      [chalk.cyan('Default Provider'), settings.defaultProvider],
      [chalk.cyan('Default Model'), settings.defaultModel],
      [chalk.cyan('OpenRouter API Key'), hasApiKey('openrouter') ? chalk.green('✓ Configured') : chalk.red('✗ Not set')],
      [chalk.cyan('Venice API Key'), hasApiKey('venice') ? chalk.green('✓ Configured') : chalk.red('✗ Not set')],
      [chalk.cyan('Anthropic API Key'), hasApiKey('anthropic') ? chalk.green('✓ Configured') : chalk.red('✗ Not set')],
      [chalk.cyan('OpenAI API Key'), hasApiKey('openai') ? chalk.green('✓ Configured') : chalk.red('✗ Not set')],
      [chalk.cyan('DeepSeek API Key'), hasApiKey('deepseek') ? chalk.green('✓ Configured') : chalk.red('✗ Not set')],
      [chalk.cyan('HuggingFace API Key'), hasApiKey('huggingface') ? chalk.green('✓ Configured') : chalk.red('✗ Not set')],
      [chalk.cyan('Config Path'), config.getConfigPath()],
    );

    console.log(table.toString());
    console.log('');
  });

program
  .command('test')
  .description('Test the LLM connection')
  .action(async () => {
    showBanner();

    const provider = config.get('defaultProvider');

    if (!hasApiKey(provider as any)) {
      showError(`No API key configured for ${provider}`);
      showInfo('Run "npx t3mp3st setup" to configure API keys');
      return;
    }

    const spinner = ora(`Testing connection to ${provider}...`).start();

    try {
      const llm = new LLMBackbone(config.getLLMConfig());
      const response = await llm.prompt('Say "Connection successful!" and nothing else.');

      spinner.succeed('Connection successful!');
      console.log('');
      console.log(chalk.cyan('Response:'), response);
      console.log('');
    } catch (error) {
      spinner.fail('Connection failed');
      showError(`${error instanceof Error ? error.message : String(error)}`);
    }
  });

program
  .command('run')
  .description('Purple Team a target: ingest a repo and spawn hats on the local server')
  .action(purpleTeamTarget);

program
  .command('models')
  .description('List available models')
  .action(async () => {
    showBanner();

    const provider = config.get('defaultProvider');
    const listing = await liveModelListing(provider);
    if (listing.source === 'unavailable') {
      showWarning(listing.note ?? `No models available for ${provider}`);
      return;
    }
    if (listing.note) showWarning(listing.note);

    console.log(chalk.bold(`Available models for ${provider}:\n`));

    const table = new Table({
      head: [chalk.cyan('Model ID')],
      style: { head: [], border: [] },
    });

    for (const model of listing.models) {
      table.push([model.id]);
    }

    console.log(table.toString());
    console.log('');
  });

// Run CLI
const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  program.parse();
}
