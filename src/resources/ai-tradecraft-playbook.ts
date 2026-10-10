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
}

export const AI_TRADECRAFT_PLAYBOOK: readonly TradecraftTechnique[] = [
  {
    "id": "passive-recon-first",
    "attckId": "T1596",
    "opsecRisk": "low",
    "detectionSurface": "Target-side telemetry is zero by design — passive DNS reservoirs, WHOIS history, certificate-transparency logs and code-search indexes are queried off-target. The residual exposure is attribution metadata: the operator's own resolver trail at the data vendor, payment and registration records behind OSINT subscriptions, and correlated query timing across vendors.",
    "tradecraftUse": "Exhaust passive sources before any packet touches the target — enumerate subdomains, mail infrastructure and exposed services from PassiveDNS and cert-transparency history so the active phase is a verification pass, not a survey. Space and diversify vendor queries, pay from compartmented accounts, and treat any source that resolves through the target (some mirrors notify the zone owner) as active, not passive.",
  },
  {
    "id": "scan-throttle-and-spread",
    "attckId": "T1595.001",
    "opsecRisk": "medium",
    "detectionSurface": "Perimeter flow telemetry (NetFlow/IPFIX, Zeek conn.log) shapes port-sweeps as unique ports or hosts per source per interval plus SYN-without-handshake ratios; IDS portscan preprocessors fire on the same cardinality, honeypot and canary ranges alert on the first touch, and SIEM velocity rules rank any external IP producing scan-like volume.",
    "tradecraftUse": "Cap scan throughput below the target's own background-noise floor, randomize target order and inter-probe delay, distribute the sweep across several rotating vantages so no single source exceeds the cardinality thresholds, and pre-exclude known canary subnets so the operation's first packet is never a tripwire. Prefer banner-less probes wherever a full handshake is not needed.",
  },
  {
    "id": "wordlist-crawl-hygiene",
    "attckId": "T1595.003",
    "opsecRisk": "medium",
    "detectionSurface": "Web access logs and WAF engines key on the scanner fingerprint: default tool user-agents, uniform request cadence, per-source 404/403 rate spikes and dictionary-ordering patterns; defenders also catch naive crawlers through content-length uniformity when virtual-host wildcard answers make every path resolve.",
    "tradecraftUse": "Customize every probe header (user-agent, accept-language order, header casing) to the site's observed client mix, test wildcard-DNS behavior before believing any 404, and drive wordlists derived from the org's own naming conventions rather than generic lists — request volume stays small and each hit is plausible enough to hide among normal traffic.",
  },
  {
    "id": "living-off-the-land-discovery",
    "attckId": "T1082",
    "opsecRisk": "low",
    "detectionSurface": "Process-lineage analytics (Sysmon EID 1, Linux auditd execve) flag discovery commands (systeminfo, uname, dmidecode, wmic qfe) whose parent is a shell or service rather than an admin session, and EDR discovery-burst correlation fires when several enumeration commands land inside one short window.",
    "tradecraftUse": "Use the binaries the host already trusts and stage discovery across the natural gaps of a normal operator session instead of one burst — take what the objective needs in a single pass and never re-run a collector whose output is already in hand; a repeated enumeration is the anomaly that writes itself into the defender's timeline.",
  },
  {
    "id": "local-network-triage",
    "attckId": "T1049",
    "opsecRisk": "low",
    "detectionSurface": "Command-line audit matches netstat/ss/arp/route vocabulary against rare-parent contexts, EDR correlates repeated connection enumeration with subsequent remote-session attempts, and hosts that enumerate live sockets on a schedule stand out against a baseline where admins run it occasionally.",
    "tradecraftUse": "Derive the network map from the context the host already has — local routing and ARP tables plus established sessions — rather than generating fresh scan traffic; sample connections once, keep the endpoints that matter to the objective, and hold enumeration volume inside what a busy administrator would plausibly produce on that host.",
  },
  {
    "id": "sandbox-check-before-exec",
    "attckId": "T1497",
    "opsecRisk": "high",
    "detectionSurface": "Detonation platforms fingerprint the checks themselves: sleep-skipping, CPUID/hypervisor-bit probes, absent user-interaction history, and samples that simply never execute in the sandbox are all scored; EDR emulators log the branch-on-environment pattern and raise a malware-family classification that outlives the operation.",
    "tradecraftUse": "Keep environment checks indistinguishable from legitimate licensing or hardware-validation logic, avoid the API sequences detonation catalogs carry, and gate on conditions that also make business sense (waiting on real user input) rather than on hardware fingerprints — and keep sandbox versus real-host behavior close enough that replay diffs never hand the defender a free signature.",
  },
  {
    "id": "payload-obfuscation-hygiene",
    "attckId": "T1027",
    "opsecRisk": "high",
    "detectionSurface": "Static engines hash and entropy-score every written artifact, YARA rules fingerprint well-known encode/decode stubs and packer templates, script-block logging (PowerShell EID 4104) deobfuscates at execution time, and detonation sandboxes recover the payload regardless of how many layers wrap it.",
    "tradecraftUse": "Generate a unique encoding per target — a byte-identical artifact is campaign-wide hash reputation handed to the defender for free — split decoding across stages so no single artifact is self-contained, and never ship lifted loader templates whose strings and structure the YARA corpus already carries.",
  },
  {
    "id": "tool-drop-minimization",
    "attckId": "T1105",
    "opsecRisk": "high",
    "detectionSurface": "FIM and file-create telemetry (Sysmon EID 11/15) catch new binaries in temp and download paths with hash-reputation lookup, proxy logs record the fetch egress, LOLBin download lineage (certutil/curl/wget spawned by a shell) is a stock detection, and retained EDR file history resurrects deleted drops for retro-hunting.",
    "tradecraftUse": "Live off the land before transferring anything, compile on-target when a toolchain exists, fetch new tooling only over an egress path the host already uses — never open a second download route — and dispose of staged artifacts through the host's own cleanup conventions while assuming the EDR kept a copy of every byte.",
  },
  {
    "id": "binary-masquerade-naming",
    "attckId": "T1036",
    "opsecRisk": "medium",
    "detectionSurface": "Signature-versus-path analytics flag Microsoft-lookalike names running from user-writable directories, EDR cross-checks file metadata and product names against the actual signer, and namespace collisions surface when the real product's installer or updater collides with the impersonating binary.",
    "tradecraftUse": "Mimic the naming of software actually installed on that host rather than impersonating security vendors — the first thing hunters grep for — sit in a plausible install path with matching metadata, and keep names stable per host: rotating names across hosts correlates them into a single campaign for the responder.",
  },
  {
    "id": "staging-directory-discipline",
    "attckId": "T1074.001",
    "opsecRisk": "medium",
    "detectionSurface": "Archive-utility lineage (7z/tar spawned by a shell over unusual directories), FIM watches on staging-typical paths, canary files seeded in sensitive shares, and DLP rules correlating archive creation with sensitive-path source material all expose a staging step before any byte leaves.",
    "tradecraftUse": "Stage in directories consistent with the host's purpose, name archives the way the org's own tooling names them, keep the staging window short so the artifacts never meet a scheduled scan, and never archive across a share boundary — that transfer is the loudest step of the collection phase.",
  },
  {
    "id": "peer-timestamp-clone",
    "attckId": "T1070.006",
    "opsecRisk": "high",
    "detectionSurface": "MFT analyzers diff $STANDARD_INFORMATION against $FILE_ATTRIBUTE timestamps, timeline builders flag zeroed or future-dated fields instantly, and backup or version stores retain the true times for the responder to reconcile against the stomped copy.",
    "tradecraftUse": "Clone timestamps from a same-directory peer file rather than zeroing them — an empty or future-dated field is a loud flag while a peer-cloned set survives casual timeline review; only stomp files legitimate tooling will not re-stat, and remember the USN journal and backups keep the truth regardless.",
  },
  {
    "id": "log-footprint-selectivity",
    "attckId": "T1070",
    "opsecRisk": "critical",
    "detectionSurface": "Windows EID 1102 (audit log cleared) and auditd log-truncation watches page immediately, log-forwarder gap detection notices silence while flow records show the host alive, and the SIEM's own ingest time-series preserve the gap as evidence even after the local log is gone.",
    "tradecraftUse": "Treat wholesale clearing as the loudest single act in this playbook: edit or remove only the lines that identify the operation, leave volume and cadence untouched, and prefer tradecraft that never writes identifying lines at all — telemetry silence must never coincide with activity visible from any other sensor.",
  },
  {
    "id": "artifact-disposal-conventions",
    "attckId": "T1070.004",
    "opsecRisk": "medium",
    "detectionSurface": "File-delete telemetry (Sysmon EID 23-class), USN journal entries, shadow copies and EDR file-history retention all preserve deleted artifacts, and a deletion burst correlated with session end is itself a detection defenders score.",
    "tradecraftUse": "Dispose through the host's own hygiene patterns — temp-cleanup jobs and plausible cache paths — so removals read as housekeeping, spread deletions across the operation instead of bursting them at session close, and assume every deleted byte is recoverable from a journal, snapshot or the EDR's retained copies.",
  },
  {
    "id": "beacon-shape-mimicry",
    "attckId": "T1071.001",
    "opsecRisk": "high",
    "detectionSurface": "Beacon-periodicity analytics score inter-request interval jitter (low stddev across N beacons), JA3/JA3S plus user-agent pairing against domain age, and transfer-size distributions; RITA-class tooling ranks any host producing small, regular POSTs toward a young domain regardless of payload content.",
    "tradecraftUse": "Sleep with large randomized jitter, ride egress paths the host already uses with content lengths inside the baseline distribution, pin the TLS fingerprint to the browser the host actually runs, and vary the profile per target class so one hunted implant never burns every other implant sharing its shape.",
  },
  {
    "id": "domain-front-redundancy",
    "attckId": "T1090.004",
    "opsecRisk": "medium",
    "detectionSurface": "SNI-versus-Host mismatch analytics catch classic fronting where providers still permit it, TLS fingerprinting pairs against young fronted domains, and netflow toward CDN ranges the tenant's normal SaaS usage never touches stands out on egress dashboards.",
    "tradecraftUse": "Front only through CDNs the target organization already consumes so destination IPs sit inside baseline, keep the fronted hostname's behavior consistent with what the provider actually licenses, and maintain several independent fronts — providers keep killing the technique, and losing one must not produce a visible burst of retries while the implant re-homes.",
  },
  {
    "id": "fallback-channel-rehearsal",
    "attckId": "T1008",
    "opsecRisk": "low",
    "detectionSurface": "The dangerous moment is the switch: a host with established C2 suddenly probing new destinations re-triggers beacon analytics on an unfamiliar tuple, DNS TXT ratios and egress spikes at failover time are flagged, and defenders explicitly watch for periodicity reappearing after a takedown.",
    "tradecraftUse": "Pre-stage and test fallback paths before the primary goes hot, make activation mimic the host's own application-retry behavior (backoff curves, not panic bursts), and keep each alternate channel's traffic shape independent so responders cannot pivot from the burned channel to the live one by pattern alone.",
  },
  {
    "id": "dns-channel-volume-hygiene",
    "attckId": "T1071.004",
    "opsecRisk": "high",
    "detectionSurface": "Resolver analytics catch tunneling on per-label Shannon entropy, TXT/NULL record ratio against the enterprise baseline, unique-subdomain cardinality under one registered domain, and query lengths pinned near the 63-byte label limit — while passive-DNS reservoirs flag the high-cardinality zone globally.",
    "tradecraftUse": "Keep queries below the entropy and cardinality thresholds, batch small payloads and favor the ordinary record types the host's baseline uses, resolve through the same resolver mix the host normally does, and throttle the zone so passive-DNS collectors never light it up as a new high-cardinality domain.",
  },
  {
    "id": "c2-piggyback-exfil",
    "attckId": "T1041",
    "opsecRisk": "medium",
    "detectionSurface": "Upload/download asymmetry on an established C2 tuple is the tell — beacon analytics keyed on byte-count vectors flag a channel that pivots from chatty to bulk, and DLP content inspection on egress catches payload fragments inside the tunneled stream.",
    "tradecraftUse": "Ride the channel that already looks legitimate at modest rates rather than opening a second egress, cap daily bytes to a small multiple of the host's baseline upload, and interleave exfil with normal command traffic so the channel's statistical shape never crosses the bulk-transfer band the egress dashboards watch.",
  },
  {
    "id": "scheduled-transfer-alignment",
    "attckId": "T1029",
    "opsecRisk": "low",
    "detectionSurface": "Egress periodicity analytics apply the same beacon clock to bulk transfer — fixed-time daily flows sized above baseline are ranked automatically, and netflow dashboards surface hosts whose outbound volume steps up at a constant hour.",
    "tradecraftUse": "Align transfers with windows the host already has — the org's own backup or sync jobs — borrowing their cadence and volume band so the schedule is indistinguishable from sanctioned jobs; move the window only when the sanctioned schedule itself changes, never ad hoc.",
  },
  {
    "id": "chunked-exfil-sizing",
    "attckId": "T1030",
    "opsecRisk": "medium",
    "detectionSurface": "Per-flow byte-volume anomaly analytics and DLP thresholds key on transfer size: SIEM egress dashboards rank upload/download skew, and size-triggered alerts fire on single large transfers toward unfamiliar destinations.",
    "tradecraftUse": "Size chunks under the thresholds visible in the target's own baseline, randomize chunk boundaries and inter-chunk delay, spread the flow across egress paths and hours, and dry-run with test chunks first so the DLP trip on content is measured before real data rides the same path.",
  },
];

export const AI_TRADECRAFT_TECHNIQUE_IDS: readonly string[] = AI_TRADECRAFT_PLAYBOOK.map(t => t.id);

/** Compact briefing (attckId + risk + discipline) for injecting into black operator/mission context. */
export function aiTradecraftBriefing(limit: number = AI_TRADECRAFT_PLAYBOOK.length): string {
  return AI_TRADECRAFT_PLAYBOOK.slice(0, limit).map(t => `• ${t.attckId} [${t.id}] (${t.opsecRisk} risk): ${t.tradecraftUse}`).join('\n');
}

/** Lookup a single technique by id. */
export function tradecraftTechnique(id: string): TradecraftTechnique | undefined {
  return AI_TRADECRAFT_PLAYBOOK.find(t => t.id === id);
}
