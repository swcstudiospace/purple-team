import { useEffect, useMemo, useState } from 'react';
import {
  SEVERITY_KEYS,
  SEVERITY_LABELS,
  STATUS_KEYS,
  STATUS_LABELS,
  SeverityBars,
  StatusBars,
  type SeverityCounts,
  type SeverityKey,
  type StatusCounts,
  type StatusKey,
} from '../reports/charts';
import '../reports/report.css';

// Shape of one entry in GET /api/findings → { findings: FindingRecord[] } (src/server.ts).
export interface Finding {
  id: string;
  missionId?: string;
  operationId?: string;
  family: string;
  title: string;
  target: string;
  claim: string;
  impact: string;
  severity: string;
  confidence: number;
  status: string;
  evidenceIds: string[];
  resourceIds: string[];
  recommendedFix: string;
  acceptanceCriteria: string[];
  owner?: string;
  createdAt: string;
  updatedAt: string;
  retestIds: string[];
}

// Error bodies from src/server.ts are { error, detail? }.
interface ServerErrorBody {
  error?: string;
  detail?: string;
}

interface FindingsResponse {
  findings: Finding[];
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; findings: Finding[] };

const JSON_FILENAME = 'purple-team-findings.json';
const MARKDOWN_FILENAME = 'purple-team-findings.md';

async function readServerMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as ServerErrorBody | null;
  const parts: string[] = [];
  const error = body?.error;
  const detail = body?.detail;
  if (error) parts.push(error);
  if (detail) parts.push(detail);
  return parts.length > 0 ? parts.join(' — ') : `Request failed with HTTP ${response.status}.`;
}

async function loadFindings(signal: AbortSignal): Promise<Finding[]> {
  let response: Response;
  try {
    response = await fetch('/api/findings', { headers: { Accept: 'application/json' }, signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('The local server did not respond. Check that it is running.');
  }
  if (!response.ok) throw new Error(await readServerMessage(response));
  const body = (await response.json().catch(() => null)) as FindingsResponse | null;
  if (body === null || !Array.isArray(body.findings)) {
    throw new Error('The server returned an unexpected findings payload.');
  }
  return body.findings;
}

function toSeverityKey(value: string): SeverityKey {
  return (SEVERITY_KEYS as readonly string[]).includes(value) ? (value as SeverityKey) : 'unknown';
}

function toStatusKey(value: string): StatusKey {
  return (STATUS_KEYS as readonly string[]).includes(value) ? (value as StatusKey) : 'unknown';
}

function tallySeverity(findings: readonly Finding[]): SeverityCounts {
  const counts = Object.fromEntries(SEVERITY_KEYS.map((key) => [key, 0])) as Record<SeverityKey, number>;
  for (const finding of findings) counts[toSeverityKey(finding.severity)] += 1;
  return counts;
}

function tallyStatus(findings: readonly Finding[]): StatusCounts {
  const counts = Object.fromEntries(STATUS_KEYS.map((key) => [key, 0])) as Record<StatusKey, number>;
  for (const finding of findings) counts[toStatusKey(finding.status)] += 1;
  return counts;
}

// Markdown table cells: one line, pipes escaped.
function mdCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

// Headings and list items: collapsed to one line.
function mdLine(value: string): string {
  return value.replace(/\s*\r?\n\s*/g, ' ').trim();
}

export function buildMarkdownReport(findings: readonly Finding[], generatedAt: Date): string {
  const lines: string[] = [];
  lines.push('# Purple Team Findings Report', '');
  lines.push(`Generated: ${generatedAt.toISOString()}`, '');
  lines.push(`Total findings: ${findings.length}`, '');
  lines.push('| ID | Title | Severity | Status | Evidence |');
  lines.push('| --- | --- | --- | --- | ---: |');
  for (const finding of findings) {
    lines.push(
      `| ${mdCell(finding.id)} | ${mdCell(finding.title)} | ${SEVERITY_LABELS[toSeverityKey(finding.severity)]} | ${STATUS_LABELS[toStatusKey(finding.status)]} | ${finding.evidenceIds.length} |`,
    );
  }
  lines.push('');

  for (const finding of findings) {
    const confidence = Number.isFinite(finding.confidence)
      ? `${Math.round(finding.confidence * 100)}%`
      : 'Unknown';
    lines.push(`## ${mdLine(finding.title)}`, '');
    lines.push(`- **ID:** ${mdLine(finding.id)}`);
    lines.push(`- **Severity:** ${SEVERITY_LABELS[toSeverityKey(finding.severity)]}`);
    lines.push(`- **Status:** ${STATUS_LABELS[toStatusKey(finding.status)]}`);
    lines.push(`- **Confidence:** ${confidence}`);
    lines.push(`- **Family:** ${mdLine(finding.family)}`);
    lines.push(`- **Target:** ${mdLine(finding.target)}`);
    if (finding.missionId) lines.push(`- **Mission:** ${mdLine(finding.missionId)}`);
    if (finding.operationId) lines.push(`- **Operation:** ${mdLine(finding.operationId)}`);
    if (finding.owner) lines.push(`- **Owner:** ${mdLine(finding.owner)}`);
    lines.push(`- **Evidence count:** ${finding.evidenceIds.length}`);
    if (finding.evidenceIds.length > 0) {
      lines.push(`- **Evidence IDs:** ${finding.evidenceIds.map(mdLine).join(', ')}`);
    }
    lines.push(`- **Updated:** ${mdLine(finding.updatedAt)}`);
    lines.push('');
    if (finding.claim.trim()) lines.push(`**Claim:** ${finding.claim.trim()}`, '');
    if (finding.impact.trim()) lines.push(`**Impact:** ${finding.impact.trim()}`, '');
    if (finding.recommendedFix.trim()) {
      lines.push(`**Recommended fix:** ${finding.recommendedFix.trim()}`, '');
    }
    if (finding.acceptanceCriteria.length > 0) {
      lines.push('**Acceptance criteria:**');
      for (const criterion of finding.acceptanceCriteria) lines.push(`- ${mdLine(criterion)}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke after the click; deferred one tick so browsers that start the download asynchronously still have the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Reports() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadFindings(controller.signal)
      .then((findings) => {
        if (controller.signal.aborted) return;
        setState({ kind: 'ready', findings });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Unknown error while loading findings.',
        });
      });
    return () => controller.abort();
  }, [attempt]);

  const findings = state.kind === 'ready' ? state.findings : undefined;

  const severityCounts = useMemo(() => tallySeverity(findings ?? []), [findings]);
  const statusCounts = useMemo(() => tallyStatus(findings ?? []), [findings]);
  const sortedFindings = useMemo(
    () =>
      findings
        ? [...findings].sort(
            (a, b) =>
              SEVERITY_KEYS.indexOf(toSeverityKey(a.severity)) -
              SEVERITY_KEYS.indexOf(toSeverityKey(b.severity)),
          )
        : [],
    [findings],
  );

  const retry = () => {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  };

  return (
    <div className="report-page">
      {state.kind === 'loading' && (
        <div className="report-skeleton" role="status" aria-live="polite" aria-busy="true">
          <span className="report-sr-only">Loading findings…</span>
          <div className="report-skeleton-line report-skeleton-short" aria-hidden="true" />
          <div className="report-skeleton-grid" aria-hidden="true">
            <div className="report-skeleton-block" />
            <div className="report-skeleton-block" />
          </div>
          <div className="report-skeleton-line report-skeleton-wide" aria-hidden="true" />
          <div className="report-skeleton-line report-skeleton-wide" aria-hidden="true" />
          <div className="report-skeleton-line report-skeleton-wide" aria-hidden="true" />
        </div>
      )}

      {state.kind === 'error' && (
        <div className="report-error" role="alert">
          <p>
            <strong>Could not load findings.</strong> {state.message}
          </p>
          <button type="button" className="report-button" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {state.kind === 'ready' && state.findings.length === 0 && (
        <p className="report-empty">No findings yet. Run a hunt or a coverage check first.</p>
      )}

      {state.kind === 'ready' && state.findings.length > 0 && (
        <>
          <header className="report-header">
            <p className="report-total">
              Total findings: <span className="report-total-value">{state.findings.length}</span>
            </p>
            <div className="report-toolbar" role="group" aria-label="Export and print">
              <button
                type="button"
                className="report-button"
                onClick={() =>
                  downloadFile(
                    JSON_FILENAME,
                    `${JSON.stringify(state.findings, null, 2)}\n`,
                    'application/json;charset=utf-8',
                  )
                }
              >
                Export JSON
              </button>
              <button
                type="button"
                className="report-button"
                onClick={() =>
                  downloadFile(
                    MARKDOWN_FILENAME,
                    buildMarkdownReport(state.findings, new Date()),
                    'text/markdown;charset=utf-8',
                  )
                }
              >
                Export Markdown
              </button>
              <button type="button" className="report-button" onClick={() => window.print()}>
                Print / PDF
              </button>
            </div>
          </header>

          <div className="report-charts">
            <section className="report-card" aria-labelledby="report-severity-heading">
              <h2 id="report-severity-heading" className="report-card-title">
                By severity
              </h2>
              <SeverityBars counts={severityCounts} />
            </section>
            <section className="report-card" aria-labelledby="report-status-heading">
              <h2 id="report-status-heading" className="report-card-title">
                By status
              </h2>
              <StatusBars counts={statusCounts} />
            </section>
          </div>

          <section className="report-card" aria-labelledby="report-findings-heading">
            <h2 id="report-findings-heading" className="report-card-title">
              Findings
            </h2>
            <div className="report-table-wrap">
              <table className="report-table">
                <caption className="report-sr-only">Findings sorted by severity, most severe first</caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Title</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="report-num">
                      Evidence
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFindings.map((finding) => (
                    <tr key={finding.id}>
                      <td className="report-mono">{finding.id}</td>
                      <td>{finding.title}</td>
                      <td>{SEVERITY_LABELS[toSeverityKey(finding.severity)]}</td>
                      <td>{STATUS_LABELS[toStatusKey(finding.status)]}</td>
                      <td className="report-num">{finding.evidenceIds.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
