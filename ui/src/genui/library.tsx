import { createLibrary, defineComponent } from '@openuidev/react-lang';
import { z } from 'zod/v4';

const SEVERITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
} as const;

const TONE_LABELS = {
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
} as const;

const Callout = defineComponent({
  name: 'Callout',
  description:
    'A short notice with one tone: info, warning or error. Use it for a caveat or a key message. Text is plain.',
  props: z.object({
    tone: z.enum(['info', 'warning', 'error']),
    text: z.string(),
  }),
  component: ({ props }) => (
    <div className="genui-callout" data-tone={props.tone}>
      <span className="genui-callout-label">{TONE_LABELS[props.tone]}</span>
      <span>{props.text}</span>
    </div>
  ),
});

const SeverityBars = defineComponent({
  name: 'SeverityBars',
  description:
    'A bar chart of labelled counts, for example findings per severity. Bars scale to the largest count.',
  props: z.object({
    items: z.array(
      z.object({
        label: z.string(),
        count: z.number().min(0),
      }),
    ),
  }),
  component: ({ props }) => {
    const max = props.items.reduce((largest, item) => Math.max(largest, item.count), 1);
    return (
      <ul className="genui-bars" aria-label="Counts">
        {props.items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="genui-bar">
            <span className="genui-bar-label">{item.label}</span>
            <span className="genui-bar-track" aria-hidden="true">
              <span className="genui-bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
            </span>
            <span className="genui-bar-count">{item.count}</span>
          </li>
        ))}
      </ul>
    );
  },
});

const VulnerabilityCard = defineComponent({
  name: 'VulnerabilityCard',
  description:
    'One security finding: a title, a severity, a CVSS base score from 0 to 10, evidence text, and next actions as plain text.',
  props: z.object({
    title: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    cvss: z.number().min(0).max(10),
    evidence: z.string(),
    nextActions: z.array(z.string()),
  }),
  component: ({ props }) => (
    <article className="genui-card" data-severity={props.severity}>
      <header className="genui-card-head">
        <h3 className="genui-card-title">{props.title}</h3>
        <span className="genui-badge" data-severity={props.severity}>
          {SEVERITY_LABELS[props.severity]}
        </span>
      </header>
      <p className="genui-cvss">
        <span className="genui-muted">CVSS</span>{' '}
        <span className="genui-cvss-value">{props.cvss.toFixed(1)}</span>
      </p>
      <p className="genui-evidence">{props.evidence}</p>
      {props.nextActions.length > 0 && (
        <div className="genui-next">
          <h4 className="genui-next-title">Next actions</h4>
          <ul>
            {props.nextActions.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  ),
});

const StackChild = z.union([Callout.ref, SeverityBars.ref, VulnerabilityCard.ref]);

const Stack = defineComponent({
  name: 'Stack',
  description:
    'Root layout. Lays out its children top to bottom in the order given. Every program has exactly one Stack as its root.',
  props: z.object({
    children: z.array(StackChild),
  }),
  component: ({ props, renderNode }) => <div className="genui-stack">{renderNode(props.children)}</div>,
});

export const genUiLibrary = createLibrary({
  root: 'Stack',
  components: [Stack, VulnerabilityCard, SeverityBars, Callout],
});
