/**
 * The component library the GenUI model may emit, as plain JSON.
 *
 * The system prompt is generated from this object with `generateSystemPrompt`, so these
 * signatures are the single source of truth for what the model can write. It is data only:
 * no zod schema and no React renderer, so the server needs neither.
 */

import type { LibrarySpec } from '@openuidev/lang-core';

export const GENUI_LIBRARY: LibrarySpec = {
  root: 'Stack',
  components: {
    Stack: {
      signature: 'Stack(children: (VulnerabilityCard | SeverityBars | Callout)[])',
      description: 'Root layout. Renders its children top to bottom, in order. Every program starts with Stack.',
    },
    VulnerabilityCard: {
      signature:
        'VulnerabilityCard(title: string, severity: "critical" | "high" | "medium" | "low" | "info", cvss: number, evidence: string, nextActions: string[])',
      description:
        'One security finding. cvss is the CVSS base score, a number from 0 to 10. evidence states what was observed. nextActions lists concrete remediation steps.',
    },
    SeverityBars: {
      signature: 'SeverityBars(items: {label: string, count: number}[])',
      description: 'Bar chart of counts per label, for example findings per severity.',
    },
    Callout: {
      signature: 'Callout(tone: "info" | "warning" | "error", text: string)',
      description: 'Short highlighted note. tone sets its colour and urgency.',
    },
  },
};
