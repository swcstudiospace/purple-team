// AI Adjudication (white) technique playbook — the governance rulebook counterpart to the
// red corpus (ai-redteam-playbook.ts) and the blue corpus (ai-defense-playbook.ts): for the
// verdicts white's arbiters cast (REFUTED / SURVIVED tallies, cite-checks, report audits),
// this is the framework rule each adjudication keys to — the section/phase/module that
// anchors it, the deterministic rule the adjudicator applies, and the evidence standard a
// vote must meet to be tallyable. Every technique is keyed to a REAL governance framework
// id from the catalog (src/arsenal/catalog.ts, TOOL_ADAPTERS governance category — the
// NIST SP 800-115 / PTES / OSSTMM import_only packs vendored as adjudication rule
// catalogs); this module imports nothing from src/arsenal (that would invert the
// dependency — arsenal imports resources), so framework correctness is asserted in the
// test, which may import both. The white-arbiter/white-auditor surfaces brief this into
// adjudication context; adjudicationTechnique() mirrors tradecraftTechnique() for
// single-technique lookup.

/** The governance rule catalogs the playbook is keyed to (catalog `governance` adapters). */
export type AdjudicationFramework = 'nist-800-115' | 'ptes' | 'osstmm';

export interface AdjudicationTechnique {
  /** kebab-case stable id */
  id: string;
  /** governance catalog id — must resolve in TOOL_ADAPTERS (see the test's membership assertion) */
  framework: AdjudicationFramework;
  /** the framework section/phase/module the rule keys to */
  control: string;
  /** the deterministic rule the white adjudicator applies to a verdict */
  adjudicationRule: string;
  /** the evidence shape a vote must carry to be admissible under the rule */
  evidenceStandard: string;
}

export const AI_ADJUDICATION_PLAYBOOK: readonly AdjudicationTechnique[] = [
  {
    "id": "roe-authorization-gate",
    "framework": "nist-800-115",
    "control": "Planning phase — rules of engagement, authorization, and test-plan review",
    "adjudicationRule": "No verdict is tallyable unless the finding's evidence cites the rules of engagement under which the action ran; evidence produced outside the negotiated ROE is discarded regardless of technical merit and the finding drops back to a candidate.",
    "evidenceStandard": "The vote cites the ROE/test-plan artifact (engagement id, scope boundary, emergency contact) and shows the triggering action inside it; scope-of-record references beat recollection — 'we were told we could' is not admissible."
  },
  {
    "id": "four-phase-traceability",
    "framework": "nist-800-115",
    "control": "Methodology phases — Planning, Discovery, Attack, Reporting",
    "adjudicationRule": "A REFUTED or SURVIVED vote must place its finding on the phase ladder: what discovery surfaced it, what attack confirmed it; a finding that skips a phase (an 'attack' result with no discovery provenance) is INCONCLUSIVE until the missing link is produced.",
    "evidenceStandard": "The vote carries a phase trail — discovery artifact (scan, enumeration), attack artifact (reproduction), report entry — each with a locator; a missing rung is named explicitly, not assumed."
  },
  {
    "id": "technique-family-coverage",
    "framework": "nist-800-115",
    "control": "Examination technique families — examination, identification, vulnerability analysis",
    "adjudicationRule": "Adjudicate 'coverage complete' claims by checking all three technique families fired: examination (document/log/ruleset review), identification (discovery, port/service), vulnerability analysis (scanning, cracking); a panel that only ran scanners cannot SURVIVE a coverage challenge.",
    "evidenceStandard": "Per-family output or an explicit family-skip with reason; bare tool counts are not coverage."
  },
  {
    "id": "finding-validation-mandate",
    "framework": "nist-800-115",
    "control": "Vulnerability-analysis techniques — detector output is a candidate until verified",
    "adjudicationRule": "Tool-reported severity is never adjudicated as-is: the vote must separate the raw detector claim from the human-verified reproduction, and unverified detector output counts only toward candidate findings, never decisive verdicts.",
    "evidenceStandard": "Side-by-side of the scanner assertion and independent confirmation (request/response, screenshot, patched-unpatched diff); votes citing only the tool verdict count as abstentions."
  },
  {
    "id": "severity-context-calibration",
    "framework": "nist-800-115",
    "control": "Attack-phase analysis — severity set by impact-to-mission, not tool labels",
    "adjudicationRule": "Severity disputes resolve against asset criticality and exploitability context (access required, complexity, exposure), not the scanner's default label; a vote that repeats a tool's CVSS without grounding is discounted.",
    "evidenceStandard": "The vote names the affected asset's business function and the exploitation context used to reach the severity; re-derived scores cite the inputs they were derived from."
  },
  {
    "id": "remediation-and-root-cause",
    "framework": "nist-800-115",
    "control": "Remediation and mitigation reporting — findings carry fixes and root cause",
    "adjudicationRule": "A SURVIVED verdict is only countable if the finding ships remediation guidance and a root-cause statement; 'it is vulnerable' without a fix path fails the reporting standard and the panel must mark the report incomplete.",
    "evidenceStandard": "A concrete mitigation (config change, patch, compensating control) plus the underlying cause class (design, implementation, configuration drift), each traceable back to the finding."
  },
  {
    "id": "success-criteria-anchor",
    "framework": "ptes",
    "control": "Phase 1 — Pre-Engagement Interactions: scope, ROE, success criteria",
    "adjudicationRule": "Every decisive vote keys back to the negotiated success criteria from pre-engagement; a finding outside the declared success criteria cannot drive a REFUTED, and unmet criteria must be stated in the verdict rationale.",
    "evidenceStandard": "A quote of the success-criteria clause with the finding mapped to it; mappings by recollection are rejected in favor of quoted paperwork."
  },
  {
    "id": "threat-model-attacker-fit",
    "framework": "ptes",
    "control": "Phase 3 — Threat Modeling: attacker profiles and asset valuation",
    "adjudicationRule": "Findings are graded against the threat model's attacker profiles (capability, access, motivation), not generic worst-case: an exploit only reachable by an internal admin-tier attacker is scored for that profile, and mismatched attacker framing invalidates the severity vote.",
    "evidenceStandard": "A named attacker profile plus the at-risk asset(s) from the valuation; votes that hedge ('any attacker could') without profile fit are discounted."
  },
  {
    "id": "vuln-analysis-evidence-chain",
    "framework": "ptes",
    "control": "Phase 4 — Vulnerability Analysis: automated scanning fused with manual validation",
    "adjudicationRule": "Adjudicators require the chain scan → reasoning → manual confirmation; a manual-only 'trust me' and a scan-only artifact are equally inadmissible for decisive votes.",
    "evidenceStandard": "The whole chain in evidence: raw tool output, the analyst's deduplication/false-positive reasoning, and the hands-on confirmation artifact — every link present."
  },
  {
    "id": "exploitation-scope-boundary",
    "framework": "ptes",
    "control": "Phase 5 — Exploitation: in-bounds weaponization only",
    "adjudicationRule": "Exploitation evidence counts only for targets inside the engagement boundary; out-of-bounds success is escalated to the operator, never tallied as engagement credit, and an adjudicator seeing it halts the vote for a scope ruling.",
    "evidenceStandard": "The target identifier matched against the scope-of-record plus the exploit artifact; scope matches are literal comparisons, not eyeballed CIDR containment."
  },
  {
    "id": "post-ex-claim-artifact-binding",
    "framework": "ptes",
    "control": "Phase 6 — Post-Exploitation: privilege and data-access documentation",
    "adjudicationRule": "Post-exploitation claims bind to artifacts: 'domain admin' means the token/screenshot/group-membership artifact; claims of data accessed cite what was touched and how far past the entry point the access extended; unbound superlatives are stricken before the tally.",
    "evidenceStandard": "A per-claim artifact pointer (credential-dump excerpt, path listing, access log) with the claim's scope ('reached, not persisted') stated explicitly."
  },
  {
    "id": "report-finding-trio",
    "framework": "ptes",
    "control": "Phase 7 — Reporting: executive summary, technical detail, remediation",
    "adjudicationRule": "A report-level verdict (REFUTED as 'the report is wrong', SURVIVED as 'the report stands') requires all three finding components present and mutually consistent; an internally inconsistent trio forces INCONCLUSIVE on the report verdict.",
    "evidenceStandard": "The three components for the contested finding, cross-checked: the executive summary's claims match the technical detail, and the remediation matches the exploited flaw."
  },
  {
    "id": "channel-coverage-enumeration",
    "framework": "osstmm",
    "control": "Channel taxonomy — Human, Physical, Wireless, Telecommunications, Data Networks",
    "adjudicationRule": "Coverage claims are adjudicated per channel: a verdict of 'tested' without enumerating which of the five channels ran is rejected; untested channels are recorded as gaps, never folded into a blanket survival.",
    "evidenceStandard": "Per-channel enumeration with in-scope/out-of-scope marking; channel omissions must be flagged as limitations in the verdict itself."
  },
  {
    "id": "four-point-interaction-decomposition",
    "framework": "osstmm",
    "control": "Interaction decomposition — visibility, access, trust, alarm",
    "adjudicationRule": "Every finding is decomposed into the interaction properties it manipulates (visibility, access, trust, alarm); a vote that cannot place the finding on at least one property describes a test result, not an adjudicable finding.",
    "evidenceStandard": "Explicit property tagging per finding (e.g. 'trust: unauthenticated relay', 'alarm: none fired') with the observed value, not just the exploit narrative."
  },
  {
    "id": "attack-surface-quantification",
    "framework": "osstmm",
    "control": "Attack-surface metrics — raw attack vectors per module",
    "adjudicationRule": "Prose risk claims are converted to counted attack vectors before tallying: the adjudicator asks 'how many attack vectors does this finding open, on which module', and a finding that resists quantification is marked speculative.",
    "evidenceStandard": "Vector counts with the module they apply to (before/after where remediation is claimed); adjectives ('huge surface') without counts are inadmissible."
  },
  {
    "id": "trust-chain-attribution",
    "framework": "osstmm",
    "control": "Trust dynamics — access obtained through trusted relationships",
    "adjudicationRule": "Findings that pivot through a trust relationship cite the specific trust grant (who trusts whom, for what); adjudicators reject pivots described as emergent ('it just had access') and score only attributed trust abuse.",
    "evidenceStandard": "The trust grant's source (service account, shared key, domain membership) and the pivot step it enabled, stated as cause → effect."
  },
  {
    "id": "controls-class-balancing",
    "framework": "osstmm",
    "control": "Controls classes — interactive, passive, reactive",
    "adjudicationRule": "Verdicts about control effectiveness must address the class the control lives in (interactive: authentication/authorization/integrity; passive: privacy/anonymity; reactive: detection/alarm), and a control counted as compensating in the wrong class is struck from the vote.",
    "evidenceStandard": "A class-tagged control inventory for the finding's path, each with its observed strength; compensating-control claims carry their class mapping."
  },
  {
    "id": "limitations-awareness-record",
    "framework": "osstmm",
    "control": "Operational record — tester limitations and target awareness during the assessment",
    "adjudicationRule": "Evidence gathered while the target was demonstrably unaware (alarms off, monitoring gaps) is weighted separately from evidence gathered under full awareness; adjudicators require the awareness context on the record before weighting a vote.",
    "evidenceStandard": "Awareness/limitation annotations per evidence item (detection active/inactive, tester-visible constraint); unannotated critical-path evidence is discounted one level."
  },
];

export const AI_ADJUDICATION_TECHNIQUE_IDS: readonly string[] = AI_ADJUDICATION_PLAYBOOK.map(t => t.id);

/** Techniques for one governance framework, playbook order. */
export function adjudicationTechniquesForFramework(framework: AdjudicationFramework): readonly AdjudicationTechnique[] {
  return AI_ADJUDICATION_PLAYBOOK.filter(t => t.framework === framework);
}

/** Compact briefing (framework + rule) for injecting into white adjudication context. */
export function aiAdjudicationBriefing(limit: number = AI_ADJUDICATION_PLAYBOOK.length): string {
  return AI_ADJUDICATION_PLAYBOOK.slice(0, limit).map(t => `• ${t.framework} [${t.id}]: ${t.adjudicationRule}`).join('\n');
}

/** Lookup a single technique by id. */
export function adjudicationTechnique(id: string): AdjudicationTechnique | undefined {
  return AI_ADJUDICATION_PLAYBOOK.find(t => t.id === id);
}
