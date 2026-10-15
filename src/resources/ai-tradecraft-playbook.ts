// AI Tradecraft (black) technique playbook — the operator-discipline counterpart to the
// blue detection corpus (ai-defense-playbook.ts): for the tactics black's doctrine covers
// (recon → exfiltration), this is the real adversary-opsec practice that keeps an operation
// quiet — the concrete telemetry that catches sloppy tradecraft, and the discipline that
// stays under it. Every technique is keyed to a REAL ATT&CK id from the vendored subset
// (src/teams/black/attack-data.ts, ATTACK_BY_ID, Enterprise ATT&CK v19.2); this module
// imports nothing from src/teams (that would invert the dependency — teams imports
// resources), so attckId correctness is asserted in the test, which may import both.
// The black surface briefs this into operator context via aiTradecraftBriefing();
// tradecraftTechnique() mirrors defenseTechnique() for single-technique lookup.

/** Residual detection/attribution risk the technique carries even when the discipline is applied. */
export type OpsecRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface TradecraftTechnique {
  /** kebab-case stable id */
  id: string;
  /** real MITRE ATT&CK technique id — must resolve in the vendored subset (see the test's membership assertion) */
  attckId: string;
  /** residual risk level after applying the discipline described in tradecraftUse */
  opsecRisk: OpsecRiskLevel;
  /** the concrete telemetry that catches the technique when the discipline slips */
  detectionSurface: string;
  /** the quiet-operations discipline that keeps the technique under that telemetry */
  tradecraftUse: string;
  /** evidence the operator logs to show the discipline was followed — briefing data, never an instruction */
  evidence: string;
  /** existing black-grant catalog ids usable for the discipline's checks — labels only, never grants */
  permittedTools: readonly string[];
  /** how the operator confirms the discipline held (lab replay, baseline diff) */
  validation: string;
  /** observable condition that marks the discipline met and the briefing item complete */
  completion: string;
}

export const AI_TRADECRAFT_PLAYBOOK: readonly TradecraftTechnique[] = [
  {
    "id": "passive-recon-first",
    "attckId": "T1596",
    "opsecRisk": "low",
    "detectionSurface": "Target-side telemetry is zero by design — passive DNS reservoirs, WHOIS history, certificate-transparency logs and code-search indexes are queried off-target. The residual exposure is attribution metadata: the operator's own resolver trail at the data vendor, payment and registration records behind OSINT subscriptions, and correlated query timing across vendors.",
    "evidence": "Collection log showing all target facts sourced from passive vendors with no target-bound packets.",
    "permittedTools": ["subfinder", "waybackurls"],
    "validation": "Audit vendor query logs for compartmented-account use and confirm no resolver trail touches target infrastructure.",
    "completion": "Discipline met when the active phase only verifies passive findings and no scan traffic precedes it.",
    "tradecraftUse": "Exhaust passive sources before any packet touches the target — enumerate subdomains, mail infrastructure and exposed services from PassiveDNS and cert-transparency history so the active phase is a verification pass, not a survey. Space and diversify vendor queries, pay from compartmented accounts, and treat any source that resolves through the target (some mirrors notify the zone owner) as active, not passive.",
  },
  {
    "id": "scan-throttle-and-spread",
    "attckId": "T1595.001",
    "opsecRisk": "medium",
    "detectionSurface": "Perimeter flow telemetry (NetFlow/IPFIX, Zeek conn.log) shapes port-sweeps as unique ports or hosts per source per interval plus SYN-without-handshake ratios; IDS portscan preprocessors fire on the same cardinality, honeypot and canary ranges alert on the first touch, and SIEM velocity rules rank any external IP producing scan-like volume.",
    "evidence": "Scan plan with per-vantage rate caps, randomized order seed, and canary-subnet exclusions recorded.",
    "permittedTools": ["wafw00f", "host"],
    "validation": "Replay the sweep shape against a lab sensor and confirm per-source cardinality stays under alert thresholds.",
    "completion": "Discipline met when the full sweep completes with no source exceeding thresholds and no canary touched.",
    "tradecraftUse": "Cap scan throughput below the target's own background-noise floor, randomize target order and inter-probe delay, distribute the sweep across several rotating vantages so no single source exceeds the cardinality thresholds, and pre-exclude known canary subnets so the operation's first packet is never a tripwire. Prefer banner-less probes wherever a full handshake is not needed.",
  },
  {
    "id": "wordlist-crawl-hygiene",
    "attckId": "T1595.003",
    "opsecRisk": "medium",
    "detectionSurface": "Web access logs and WAF engines key on the scanner fingerprint: default tool user-agents, uniform request cadence, per-source 404/403 rate spikes and dictionary-ordering patterns; defenders also catch naive crawlers through content-length uniformity when virtual-host wildcard answers make every path resolve.",
    "evidence": "Probe log with customized headers, wildcard-DNS baseline result, and org-derived wordlist version.",
    "permittedTools": ["httpx", "curl"],
    "validation": "Diff probe headers against the observed client mix and confirm 404 and 403 rates stay inside normal bands.",
    "completion": "Discipline met when enumeration stays plausible among normal traffic with wildcard behavior accounted for.",
    "tradecraftUse": "Customize every probe header (user-agent, accept-language order, header casing) to the site's observed client mix, test wildcard-DNS behavior before believing any 404, and drive wordlists derived from the org's own naming conventions rather than generic lists — request volume stays small and each hit is plausible enough to hide among normal traffic.",
  },
  {
    "id": "living-off-the-land-discovery",
    "attckId": "T1082",
    "opsecRisk": "low",
    "detectionSurface": "Process-lineage analytics (Sysmon EID 1, Linux auditd execve) flag discovery commands (systeminfo, uname, dmidecode, wmic qfe) whose parent is a shell or service rather than an admin session, and EDR discovery-burst correlation fires when several enumeration commands land inside one short window.",
    "evidence": "Single-pass collection record listing each host binary used and the objective need for its output.",
    "permittedTools": ["attack-navigator", "caldera"],
    "validation": "Review host telemetry for burst correlation and confirm discovery commands never repeat within one session.",
    "completion": "Discipline met when objectives are met in one pass with no re-run collectors on the timeline.",
    "tradecraftUse": "Use the binaries the host already trusts and stage discovery across the natural gaps of a normal operator session instead of one burst — take what the objective needs in a single pass and never re-run a collector whose output is already in hand; a repeated enumeration is the anomaly that writes itself into the defender's timeline.",
  },
  {
    "id": "local-network-triage",
    "attckId": "T1049",
    "opsecRisk": "low",
    "detectionSurface": "Command-line audit matches netstat/ss/arp/route vocabulary against rare-parent contexts, EDR correlates repeated connection enumeration with subsequent remote-session attempts, and hosts that enumerate live sockets on a schedule stand out against a baseline where admins run it occasionally.",
    "evidence": "Network map derived from host-local tables with the sampling timestamps noted.",
    "permittedTools": ["host", "dnsx"],
    "validation": "Compare enumeration volume against a busy-administrator baseline for that host class.",
    "completion": "Discipline met when the map is complete without fresh scan traffic beyond host-local context.",
    "tradecraftUse": "Derive the network map from the context the host already has — local routing and ARP tables plus established sessions — rather than generating fresh scan traffic; sample connections once, keep the endpoints that matter to the objective, and hold enumeration volume inside what a busy administrator would plausibly produce on that host.",
  },
  {
    "id": "sandbox-check-before-exec",
    "attckId": "T1497",
    "opsecRisk": "high",
    "detectionSurface": "Detonation platforms fingerprint the checks themselves: sleep-skipping, CPUID/hypervisor-bit probes, absent user-interaction history, and samples that simply never execute in the sandbox are all scored; EDR emulators log the branch-on-environment pattern and raise a malware-family classification that outlives the operation.",
    "evidence": "Gating logic review showing business-plausible conditions rather than hardware fingerprints.",
    "permittedTools": ["caldera", "attack-navigator"],
    "validation": "Detonate in a lab sandbox and confirm the sample behavior matches real-host behavior with no flagged API sequences.",
    "completion": "Discipline met when sandbox and real-host behavior diffs yield no signature-grade differences.",
    "tradecraftUse": "Keep environment checks indistinguishable from legitimate licensing or hardware-validation logic, avoid the API sequences detonation catalogs carry, and gate on conditions that also make business sense (waiting on real user input) rather than on hardware fingerprints — and keep sandbox versus real-host behavior close enough that replay diffs never hand the defender a free signature.",
  },
  {
    "id": "payload-obfuscation-hygiene",
    "attckId": "T1027",
    "opsecRisk": "high",
    "detectionSurface": "Static engines hash and entropy-score every written artifact, YARA rules fingerprint well-known encode/decode stubs and packer templates, script-block logging (PowerShell EID 4104) deobfuscates at execution time, and detonation sandboxes recover the payload regardless of how many layers wrap it.",
    "evidence": "Per-target encoding record proving artifact uniqueness with staged decode split points.",
    "permittedTools": ["caldera", "attack-navigator"],
    "validation": "Score the artifact against lab YARA and entropy engines and confirm no lifted loader template strings.",
    "completion": "Discipline met when each target carries a unique artifact with no self-contained decode stage.",
    "tradecraftUse": "Generate a unique encoding per target — a byte-identical artifact is campaign-wide hash reputation handed to the defender for free — split decoding across stages so no single artifact is self-contained, and never ship lifted loader templates whose strings and structure the YARA corpus already carries.",
  },
  {
    "id": "tool-drop-minimization",
    "attckId": "T1105",
    "opsecRisk": "high",
    "detectionSurface": "FIM and file-create telemetry (Sysmon EID 11/15) catch new binaries in temp and download paths with hash-reputation lookup, proxy logs record the fetch egress, LOLBin download lineage (certutil/curl/wget spawned by a shell) is a stock detection, and retained EDR file history resurrects deleted drops for retro-hunting.",
    "evidence": "Transfer log limited to the existing host egress path with staged-artifact disposal timestamps.",
    "permittedTools": ["curl", "httpx"],
    "validation": "Confirm no second download route opened and every fetched byte carries an EDR-retained-copy assumption.",
    "completion": "Discipline met when all tooling arrives over existing egress and staging is disposed via host conventions.",
    "tradecraftUse": "Live off the land before transferring anything, compile on-target when a toolchain exists, fetch new tooling only over an egress path the host already uses — never open a second download route — and dispose of staged artifacts through the host's own cleanup conventions while assuming the EDR kept a copy of every byte.",
  },
  {
    "id": "binary-masquerade-naming",
    "attckId": "T1036",
    "opsecRisk": "medium",
    "detectionSurface": "Signature-versus-path analytics flag Microsoft-lookalike names running from user-writable directories, EDR cross-checks file metadata and product names against the actual signer, and namespace collisions surface when the real product's installer or updater collides with the impersonating binary.",
    "evidence": "Naming record tied to software actually installed on that host with matching metadata noted.",
    "permittedTools": ["caldera", "attack-navigator"],
    "validation": "Check the name against hunter grep patterns for vendor impersonation and confirm per-host name stability.",
    "completion": "Discipline met when the binary sits plausibly with stable names that do not correlate across hosts.",
    "tradecraftUse": "Mimic the naming of software actually installed on that host rather than impersonating security vendors — the first thing hunters grep for — sit in a plausible install path with matching metadata, and keep names stable per host: rotating names across hosts correlates them into a single campaign for the responder.",
  },
  {
    "id": "staging-directory-discipline",
    "attckId": "T1074.001",
    "opsecRisk": "medium",
    "detectionSurface": "Archive-utility lineage (7z/tar spawned by a shell over unusual directories), FIM watches on staging-typical paths, canary files seeded in sensitive shares, and DLP rules correlating archive creation with sensitive-path source material all expose a staging step before any byte leaves.",
    "evidence": "Staging record with host-consistent directory, org-style archive name, and a short staging window.",
    "permittedTools": ["caldera", "attack-navigator"],
    "validation": "Confirm no archive crossed a share boundary and the window never met a scheduled scan.",
    "completion": "Discipline met when staging completes inside the window with no cross-share transfer.",
    "tradecraftUse": "Stage in directories consistent with the host's purpose, name archives the way the org's own tooling names them, keep the staging window short so the artifacts never meet a scheduled scan, and never archive across a share boundary — that transfer is the loudest step of the collection phase.",
  },
  {
    "id": "peer-timestamp-clone",
    "attckId": "T1070.006",
    "opsecRisk": "high",
    "detectionSurface": "MFT analyzers diff $STANDARD_INFORMATION against $FILE_ATTRIBUTE timestamps, timeline builders flag zeroed or future-dated fields instantly, and backup or version stores retain the true times for the responder to reconcile against the stomped copy.",
    "evidence": "Timestamp record cloned from a same-directory peer with USN-journal exposure accepted.",
    "permittedTools": ["caldera", "attack-navigator"],
    "validation": "Diff MFT timestamp fields against the peer and confirm no zeroed or future-dated values.",
    "completion": "Discipline met when the file survives casual timeline review with peer-consistent timestamps.",
    "tradecraftUse": "Clone timestamps from a same-directory peer file rather than zeroing them — an empty or future-dated field is a loud flag while a peer-cloned set survives casual timeline review; only stomp files legitimate tooling will not re-stat, and remember the USN journal and backups keep the truth regardless.",
  },
  {
    "id": "log-footprint-selectivity",
    "attckId": "T1070",
    "opsecRisk": "critical",
    "detectionSurface": "Windows EID 1102 (audit log cleared) and auditd log-truncation watches page immediately, log-forwarder gap detection notices silence while flow records show the host alive, and the SIEM's own ingest time-series preserve the gap as evidence even after the local log is gone.",
    "evidence": "Edit-scoped removal log showing volume and cadence preserved with only identifying lines handled.",
    "permittedTools": ["caldera", "attack-navigator"],
    "validation": "Confirm no wholesale-clear events exist and forwarder gap detection never coincides with session activity.",
    "completion": "Discipline met when telemetry volume is untouched and no silence gap overlaps operation activity.",
    "tradecraftUse": "Treat wholesale clearing as the loudest single act in this playbook: edit or remove only the lines that identify the operation, leave volume and cadence untouched, and prefer tradecraft that never writes identifying lines at all — telemetry silence must never coincide with activity visible from any other sensor.",
  },
  {
    "id": "artifact-disposal-conventions",
    "attckId": "T1070.004",
    "opsecRisk": "medium",
    "detectionSurface": "File-delete telemetry (Sysmon EID 23-class), USN journal entries, shadow copies and EDR file-history retention all preserve deleted artifacts, and a deletion burst correlated with session end is itself a detection defenders score.",
    "evidence": "Disposal log spread across the operation through host hygiene paths.",
    "permittedTools": ["caldera", "attack-navigator"],
    "validation": "Confirm no deletion burst correlates with session end in file-delete telemetry.",
    "completion": "Discipline met when removals read as housekeeping with recoverability assumed throughout.",
    "tradecraftUse": "Dispose through the host's own hygiene patterns — temp-cleanup jobs and plausible cache paths — so removals read as housekeeping, spread deletions across the operation instead of bursting them at session close, and assume every deleted byte is recoverable from a journal, snapshot or the EDR's retained copies.",
  },
  {
    "id": "beacon-shape-mimicry",
    "attckId": "T1071.001",
    "opsecRisk": "high",
    "detectionSurface": "Beacon-periodicity analytics score inter-request interval jitter (low stddev across N beacons), JA3/JA3S plus user-agent pairing against domain age, and transfer-size distributions; RITA-class tooling ranks any host producing small, regular POSTs toward a young domain regardless of payload content.",
    "evidence": "Beacon profile with jitter distribution, borrowed egress path, and pinned TLS fingerprint noted.",
    "permittedTools": ["curl", "httpx"],
    "validation": "Score the profile with lab beacon analytics and confirm interval jitter and sizes sit inside baseline.",
    "completion": "Discipline met when the channel holds with per-target-class profiles that do not pivot together.",
    "tradecraftUse": "Sleep with large randomized jitter, ride egress paths the host already uses with content lengths inside the baseline distribution, pin the TLS fingerprint to the browser the host actually runs, and vary the profile per target class so one hunted implant never burns every other implant sharing its shape.",
  },
  {
    "id": "domain-front-redundancy",
    "attckId": "T1090.004",
    "opsecRisk": "medium",
    "detectionSurface": "SNI-versus-Host mismatch analytics catch classic fronting where providers still permit it, TLS fingerprinting pairs against young fronted domains, and netflow toward CDN ranges the tenant's normal SaaS usage never touches stands out on egress dashboards.",
    "evidence": "Front inventory limited to CDNs the target consumes with independent fallback fronts listed.",
    "permittedTools": ["curl", "httpx"],
    "validation": "Confirm destination IPs sit inside the tenant baseline and fronted behavior matches provider licensing.",
    "completion": "Discipline met when losing one front causes no visible retry burst during re-homing.",
    "tradecraftUse": "Front only through CDNs the target organization already consumes so destination IPs sit inside baseline, keep the fronted hostname's behavior consistent with what the provider actually licenses, and maintain several independent fronts — providers keep killing the technique, and losing one must not produce a visible burst of retries while the implant re-homes.",
  },
  {
    "id": "fallback-channel-rehearsal",
    "attckId": "T1008",
    "opsecRisk": "low",
    "detectionSurface": "The dangerous moment is the switch: a host with established C2 suddenly probing new destinations re-triggers beacon analytics on an unfamiliar tuple, DNS TXT ratios and egress spikes at failover time are flagged, and defenders explicitly watch for periodicity reappearing after a takedown.",
    "evidence": "Pre-staged fallback paths with tested activation mimicking application-retry backoff.",
    "permittedTools": ["host", "dnsx"],
    "validation": "Fail over in a lab and confirm no panic-burst shape and no pattern pivot from the old channel.",
    "completion": "Discipline met when fallback activates with independent traffic shape on first try.",
    "tradecraftUse": "Pre-stage and test fallback paths before the primary goes hot, make activation mimic the host's own application-retry behavior (backoff curves, not panic bursts), and keep each alternate channel's traffic shape independent so responders cannot pivot from the burned channel to the live one by pattern alone.",
  },
  {
    "id": "dns-channel-volume-hygiene",
    "attckId": "T1071.004",
    "opsecRisk": "high",
    "detectionSurface": "Resolver analytics catch tunneling on per-label Shannon entropy, TXT/NULL record ratio against the enterprise baseline, unique-subdomain cardinality under one registered domain, and query lengths pinned near the 63-byte label limit — while passive-DNS reservoirs flag the high-cardinality zone globally.",
    "evidence": "Query budget record with entropy, cardinality, and record-type mix inside host baseline.",
    "permittedTools": ["dnsx", "host"],
    "validation": "Resolve through the normal host resolver mix in a lab and confirm passive-DNS collectors stay quiet.",
    "completion": "Discipline met when the zone never lights up as a new high-cardinality domain.",
    "tradecraftUse": "Keep queries below the entropy and cardinality thresholds, batch small payloads and favor the ordinary record types the host's baseline uses, resolve through the same resolver mix the host normally does, and throttle the zone so passive-DNS collectors never light it up as a new high-cardinality domain.",
  },
  {
    "id": "c2-piggyback-exfil",
    "attckId": "T1041",
    "opsecRisk": "medium",
    "detectionSurface": "Upload/download asymmetry on an established C2 tuple is the tell — beacon analytics keyed on byte-count vectors flag a channel that pivots from chatty to bulk, and DLP content inspection on egress catches payload fragments inside the tunneled stream.",
    "evidence": "Transfer log capped at a small multiple of host baseline upload interleaved with command traffic.",
    "permittedTools": ["curl", "httpx"],
    "validation": "Confirm the channel shape never crosses the bulk-transfer band on egress dashboards.",
    "completion": "Discipline met when exfil completes with the channel statistical shape unchanged.",
    "tradecraftUse": "Ride the channel that already looks legitimate at modest rates rather than opening a second egress, cap daily bytes to a small multiple of the host's baseline upload, and interleave exfil with normal command traffic so the channel's statistical shape never crosses the bulk-transfer band the egress dashboards watch.",
  },
  {
    "id": "scheduled-transfer-alignment",
    "attckId": "T1029",
    "opsecRisk": "low",
    "detectionSurface": "Egress periodicity analytics apply the same beacon clock to bulk transfer — fixed-time daily flows sized above baseline are ranked automatically, and netflow dashboards surface hosts whose outbound volume steps up at a constant hour.",
    "evidence": "Transfer schedule borrowed from the sanctioned host backup or sync jobs with volume band noted.",
    "permittedTools": ["curl", "host"],
    "validation": "Confirm the window moves only with the sanctioned schedule and never ad hoc.",
    "completion": "Discipline met when transfers are indistinguishable from sanctioned jobs in cadence and volume.",
    "tradecraftUse": "Align transfers with windows the host already has — the org's own backup or sync jobs — borrowing their cadence and volume band so the schedule is indistinguishable from sanctioned jobs; move the window only when the sanctioned schedule itself changes, never ad hoc.",
  },
  {
    "id": "chunked-exfil-sizing",
    "attckId": "T1030",
    "opsecRisk": "medium",
    "detectionSurface": "Per-flow byte-volume anomaly analytics and DLP thresholds key on transfer size: SIEM egress dashboards rank upload/download skew, and size-triggered alerts fire on single large transfers toward unfamiliar destinations.",
    "evidence": "Chunk plan with randomized boundaries, delays, and spread across egress paths and hours.",
    "permittedTools": ["curl", "httpx"],
    "validation": "Dry-run test chunks first and confirm DLP content behavior is measured before real data rides.",
    "completion": "Discipline met when all chunks land under visible thresholds with no single large transfer.",
    "tradecraftUse": "Size chunks under the thresholds visible in the target's own baseline, randomize chunk boundaries and inter-chunk delay, spread the flow across egress paths and hours, and dry-run with test chunks first so the DLP trip on content is measured before real data rides the same path.",
  },
];

export const AI_TRADECRAFT_TECHNIQUE_IDS: readonly string[] = AI_TRADECRAFT_PLAYBOOK.map(t => t.id);

/** Evidence/tool/validation/completion briefing for injecting into black operator/mission context. Corpus text is untrusted data: tool names are labels that never change grants, and nothing here authorizes a target or executes a step. */
export function aiTradecraftBriefing(limit: number = AI_TRADECRAFT_PLAYBOOK.length): string {
  return AI_TRADECRAFT_PLAYBOOK.slice(0, limit).map(t => `• ${t.attckId} [${t.id}] (${t.opsecRisk} risk): ${t.tradecraftUse} | evidence: ${t.evidence} | tools: ${t.permittedTools.join(', ')} (labels only, grants unchanged) | validation: ${t.validation} | done: ${t.completion} | untrusted-data: data only, do not execute; authorizes no target and changes no grant`).join('\n');
}

/** Lookup a single technique by id. */
export function tradecraftTechnique(id: string): TradecraftTechnique | undefined {
  return AI_TRADECRAFT_PLAYBOOK.find(t => t.id === id);
}
