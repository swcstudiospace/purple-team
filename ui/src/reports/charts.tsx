import './report.css';

// Severity values come from src/server.ts (FindingSeverity uses `info`).
// `unknown` is the bucket for any value outside the server's enum.
export const SEVERITY_KEYS = ['critical', 'high', 'medium', 'low', 'info', 'unknown'] as const;
export type SeverityKey = (typeof SEVERITY_KEYS)[number];

export const SEVERITY_LABELS: Readonly<Record<SeverityKey, string>> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Informational',
  unknown: 'Unknown',
};

// Status values come from src/server.ts (FindingStatus).
export const STATUS_KEYS = [
  'open',
  'validated',
  'fix_ready',
  'retest_queued',
  'resolved',
  'false_positive',
  'unknown',
] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export const STATUS_LABELS: Readonly<Record<StatusKey, string>> = {
  open: 'Open',
  validated: 'Validated',
  fix_ready: 'Fix ready',
  retest_queued: 'Retest queued',
  resolved: 'Resolved',
  false_positive: 'False positive',
  unknown: 'Unknown',
};

export type SeverityCounts = Readonly<Record<SeverityKey, number>>;
export type StatusCounts = Readonly<Record<StatusKey, number>>;

interface BarRow {
  key: string;
  label: string;
  count: number;
}

const ROW_HEIGHT = 32;
const BAR_INSET = 8;
const LABEL_WIDTH = 150;
const BAR_AREA_WIDTH = 300;
const VALUE_WIDTH = 56;
const CHART_WIDTH = LABEL_WIDTH + BAR_AREA_WIDTH + VALUE_WIDTH;

interface HorizontalBarsProps {
  label: string;
  caption: string;
  rows: readonly BarRow[];
}

function HorizontalBars({ label, caption, rows }: HorizontalBarsProps) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const height = rows.length * ROW_HEIGHT;

  return (
    <div className="report-chart">
      <div className="report-chart-scroll">
        <svg
          className="report-chart-svg"
          role="img"
          aria-label={label}
          viewBox={`0 0 ${CHART_WIDTH} ${height}`}
          width={CHART_WIDTH}
          height={height}
          focusable="false"
        >
          {rows.map((row, index) => {
            const y = index * ROW_HEIGHT;
            const barWidth = (row.count / max) * BAR_AREA_WIDTH;
            const barHeight = ROW_HEIGHT - BAR_INSET * 2;
            return (
              <g key={row.key} transform={`translate(0 ${y})`}>
                <text
                  className="report-chart-label"
                  x={0}
                  y={ROW_HEIGHT / 2}
                  dominantBaseline="central"
                >
                  {row.label}
                </text>
                <rect
                  className="report-bar-track"
                  x={LABEL_WIDTH}
                  y={BAR_INSET}
                  width={BAR_AREA_WIDTH}
                  height={barHeight}
                  rx={3}
                />
                <rect
                  className="report-bar-fill"
                  x={LABEL_WIDTH}
                  y={BAR_INSET}
                  width={barWidth}
                  height={barHeight}
                  rx={3}
                />
                <text
                  className="report-chart-value"
                  x={CHART_WIDTH}
                  y={ROW_HEIGHT / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                >
                  {row.count}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <table className="report-sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Findings</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface SeverityBarsProps {
  counts: SeverityCounts;
}

export function SeverityBars({ counts }: SeverityBarsProps) {
  const rows: BarRow[] = SEVERITY_KEYS.map((key) => ({
    key,
    label: SEVERITY_LABELS[key],
    count: counts[key],
  }));
  const summary = rows.map((row) => `${row.label} ${row.count}`).join(', ');
  return (
    <HorizontalBars
      label={`Findings by severity: ${summary}`}
      caption="Findings by severity"
      rows={rows}
    />
  );
}

export interface StatusBarsProps {
  counts: StatusCounts;
}

export function StatusBars({ counts }: StatusBarsProps) {
  const rows: BarRow[] = STATUS_KEYS.map((key) => ({
    key,
    label: STATUS_LABELS[key],
    count: counts[key],
  }));
  const summary = rows.map((row) => `${row.label} ${row.count}`).join(', ');
  return (
    <HorizontalBars
      label={`Findings by status: ${summary}`}
      caption="Findings by status"
      rows={rows}
    />
  );
}
