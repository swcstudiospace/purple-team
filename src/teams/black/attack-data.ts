/**
 * Vendored MITRE ATT&CK(r) Enterprise subset — the black suite's attack-data
 * vocabulary. Pure data + lookups: no I/O, no network, no persistence.
 *
 * Source:    https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json
 * Fetched:   2026-10-10 (Enterprise ATT&CK v19.2, collection modified 2026-08-05)
 * Trim rule (disclosed): every live (non-revoked, non-deprecated) technique
 *            whose id appears in T3MP3ST's black surface — operator/hat cards
 *            (src/operators/index.ts, src/teams/hats.ts), mission policies
 *            (src/mission/index.ts), the knowledge stub (src/stubs/index.ts) —
 *            plus the channel/noise vocabularies of the black engines
 *            (./noise.ts, ./exfil.ts), restricted to the six tactics black's
 *            doctrine covers: reconnaissance, discovery, stealth, collection,
 *            command-and-control, exfiltration (ATT&CK v19 renamed Defense
 *            Evasion to Stealth, TA0005; the black doctrine maps 1:1). Revoked
 *            upstream ids are excluded outright (e.g. T1562 Impair Defenses).
 * Trims:     descriptions keep the first upstream paragraph verbatim (a trailing
 *            ellipsis marks truncation); detection notes keep the upstream
 *            detection strategy (DETxxxx) and at most 3 of its
 *            analytics (ANxxxx) verbatim, with moreAnalytics counting the rest.
 *            Technique ids, names, tactics, platforms and sub-technique flags
 *            are verbatim from the bundle. No ids are invented — every id here
 *            resolves upstream, and engine modules must never emit an id that
 *            is absent from ATTACK_BY_ID.
 * Re-vendor: fetch the bundle URL above, re-run the extraction with the same
 *            trim rule, and replace ATTACK_TECHNIQUES below. The file stays a
 *            pure data module so `tsc` ships it inside dist/ with no runtime
 *            file reads.
 *
 * ATT&CK Terms of Use (https://attack.mitre.org/resources/terms-of-use/) —
 * reproduced as required:
 *
 * Copyright (c) The MITRE Corporation. All rights reserved.
 *
 * MITRE hereby grants you a non-exclusive, royalty-free license to use ATT&CK
 * for research, development and commercial purposes. Any copy you make for
 * such purposes is authorized provided that you reproduce MITRE's copyright
 * designation and this license in any such copy.
 *
 * ALL DOCUMENTS AND THE INFORMATION CONTAINED THEREIN ARE PROVIDED "AS IS"
 * AND THE MITRE CORPORATION DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO ANY WARRANTY THAT THE USE OF THE INFORMATION
 * THEREIN WILL NOT INFRINGE ANY RIGHTS OR ANY IMPLIED WARRANTIES OF
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.
 */

/** Source URL of the vendored STIX bundle, kept for provenance checks and tests. */
export const ATTACK_DATA_SOURCE_URL =
  'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json';

/** ISO date the subset was vendored (not used at runtime). */
export const ATTACK_DATA_FETCHED = '2026-10-10';

/** Upstream ATT&CK version the subset was vendored from. */
export const ATTACK_VERSION = '19.2';

/** The ATT&CK tactics black's doctrine covers, in doctrine order. */
export type AttackTacticKey =
  | 'reconnaissance'
  | 'discovery'
  | 'stealth'
  | 'collection'
  | 'command-and-control'
  | 'exfiltration';

/** One vendored tactic: its ATT&CK tactic id, doctrine key, and upstream name. */
export interface AttackTactic {
  id: string;
  key: AttackTacticKey;
  name: string;
}

/** The vendored tactics, in doctrine order (TA0005 is Stealth in ATT&CK v19+). */
export const ATTACK_TACTICS: readonly AttackTactic[] = [
  { id: 'TA0043', key: 'reconnaissance', name: 'Reconnaissance' },
  { id: 'TA0007', key: 'discovery', name: 'Discovery' },
  { id: 'TA0005', key: 'stealth', name: 'Stealth' },
  { id: 'TA0009', key: 'collection', name: 'Collection' },
  { id: 'TA0011', key: 'command-and-control', name: 'Command and Control' },
  { id: 'TA0010', key: 'exfiltration', name: 'Exfiltration' },
];

/** One analytic from the upstream detection strategy for a technique. */
export interface AttackDetectionAnalytic {
  /** Upstream analytic id, e.g. "AN0367". */
  id: string;
  /** Verbatim upstream detection note. */
  description: string;
}

/** Detection notes for a technique: the upstream strategy plus its analytics. */
export interface AttackDetection {
  /** Upstream detection strategy id, e.g. "DET0131". */
  strategyId: string;
  strategyName: string;
  /** First 3 analytics verbatim (see the trim rule in the header). */
  analytics: readonly AttackDetectionAnalytic[];
  /** How many further analytics the upstream strategy carries beyond the cap. */
  moreAnalytics: number;
}

/** One vendored ATT&CK technique (top-level or sub-technique). */
export interface AttackTechnique {
  /** Canonical ATT&CK id, e.g. "T1048.003". */
  id: string;
  name: string;
  /** Vendored tactics the technique belongs to, in doctrine order. */
  tactics: readonly AttackTacticKey[];
  /** Upstream platform list (may be empty for reconnaissance techniques). */
  platforms: readonly string[];
  isSubTechnique: boolean;
  /** Dotted-id parent ("T1048" for "T1048.003"), null for top-level techniques. */
  parentId: string | null;
  /** First paragraph of the upstream description, verbatim; ellipsis marks truncation. */
  description: string;
  /** Upstream detection notes, null when the strategy ships none. */
  detection: AttackDetection | null;
}

export const ATTACK_TECHNIQUES: readonly AttackTechnique[] = [
  {
    id: "T1595",
    name: "Active Scanning",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may execute active reconnaissance scans to gather information that can be used during targeting. Active scans are those where the adversary probes victim infrastructure via network traffic, as opposed to other forms of reconnaissance that do not involve direct interaction.",
    detection: {
      strategyId: "DET0830",
      strategyName: "Detection of Active Scanning",
      analytics: [{ id: "AN1962", description: "Monitor network data for uncommon data flows. Processes utilizing the network that do not normally have network communication or have never been seen before are suspicious. Monitor and analyze traffic patterns and packet inspection associated to protocol(s) that do not follow the expected protocol standards and traffic flows (e.g extraneous packets that do not belong to established flows, gratuitous or anomalous traffic patterns, anomalous syntax, or structure). Consider correlation with process monitoring and command line to detect anomalous processes execution and command line arguments associated to traffic patterns (e.g. monitor anomalies in use of files that do not normally initiate connections for respective protocol(s))." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1595.001",
    name: "Scanning IP Blocks",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: true,
    parentId: "T1595",
    description: "Adversaries may scan victim IP blocks to gather information that can be used during targeting. Public IP addresses may be allocated to organizations by block, or a range of sequential addresses.",
    detection: {
      strategyId: "DET0817",
      strategyName: "Detection of Scanning IP Blocks",
      analytics: [{ id: "AN1949", description: "Monitoring the content of network traffic can help detect patterns associated with active scanning activities. This can include identifying repeated connection attempts, unusual scanning behaviors, or probing activity targeting multiple IP addresses across a network. Monitor network data for uncommon data flows. Processes utilizing the network that do not normally have network communication or have never been seen before are suspicious." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1595.002",
    name: "Vulnerability Scanning",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: true,
    parentId: "T1595",
    description: "Adversaries may scan victims for vulnerabilities that can be used during targeting. Vulnerability scans typically check if the configuration of a target host/application (ex: software and version) potentially aligns with the target of a specific exploit the adversary may seek to use.",
    detection: {
      strategyId: "DET0867",
      strategyName: "Detection of Vulnerability Scanning",
      analytics: [{ id: "AN1999", description: "Monitor and analyze traffic patterns and packet inspection associated to protocol(s) that do not follow the expected protocol standards and traffic flows (e.g extraneous packets that do not belong to established flows, gratuitous or anomalous traffic patterns, anomalous syntax, or structure). Consider correlation with process monitoring and command line to detect anomalous processes execution and command line arguments associated to traffic patterns (e.g. monitor anomalies in use of files that do not normally initiate connections for respective protocol(s)). Monitor network data for uncommon data flows. Processes utilizing the network that do not normally have network communication or have never been seen before are suspicious." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1595.003",
    name: "Wordlist Scanning",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: true,
    parentId: "T1595",
    description: "Adversaries may iteratively probe infrastructure using brute-forcing and crawling techniques. While this technique employs similar methods to [Brute Force](https://attack.mitre.org/techniques/T1110), its goal is the identification of content and infrastructure rather than the discovery of valid credentials. Wordlists used in these scans may contain generic, commonly used names and file extensions or terms specific to a particular software. Adversaries may …",
    detection: {
      strategyId: "DET0868",
      strategyName: "Detection of Wordlist Scanning",
      analytics: [{ id: "AN2000", description: "Monitor for suspicious network traffic that could be indicative of scanning, such as large quantities originating from a single source (especially if the source is known to be associated with an adversary/botnet)." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1589",
    name: "Gather Victim Identity Information",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may gather information about the victim's identity that can be used during targeting. Information about identities may include a variety of details, including personal data (ex: employee names, email addresses, security question responses, etc.) as well as sensitive details such as credentials or multi-factor authentication (MFA) configurations.",
    detection: {
      strategyId: "DET0841",
      strategyName: "Detection of Gather Victim Identity Information",
      analytics: [{ id: "AN1973", description: "Monitor for suspicious network traffic that could be indicative of probing for user information, such as large/iterative quantities of authentication requests originating from a single source (especially if the source is known to be associated with an adversary/botnet). Analyzing web metadata may also reveal artifacts that can be attributed to potentially malicious activity, such as referer or user-agent string HTTP/S fields." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1590",
    name: "Gather Victim Network Information",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may gather information about the victim's networks that can be used during targeting. Information about networks may include a variety of details, including administrative data (ex: IP ranges, domain names, etc.) as well as specifics regarding its topology and operations.",
    detection: {
      strategyId: "DET0869",
      strategyName: "Detection of Gather Victim Network Information",
      analytics: [{ id: "AN2001", description: "Much of this activity may have a very high occurrence and associated false positive rate, as well as potentially taking place outside the visibility of the target organization, making detection difficult for defenders. Detection efforts may be focused on related stages of the adversary lifecycle, such as during Initial Access." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1591",
    name: "Gather Victim Org Information",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may gather information about the victim's organization that can be used during targeting. Information about an organization may include a variety of details, including the names of divisions/departments, specifics of business operations, as well as the roles and responsibilities of key employees.",
    detection: {
      strategyId: "DET0890",
      strategyName: "Detection of Gather Victim Org Information",
      analytics: [{ id: "AN2022", description: "Much of this activity may have a very high occurrence and associated false positive rate, as well as potentially taking place outside the visibility of the target organization, making detection difficult for defenders. Detection efforts may be focused on related stages of the adversary lifecycle, such as during Initial Access." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1592",
    name: "Gather Victim Host Information",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may gather information about the victim's hosts that can be used during targeting. Information about hosts may include a variety of details, including administrative data (ex: name, assigned IP, functionality, etc.) as well as specifics regarding its configuration (ex: operating system, language, etc.).",
    detection: {
      strategyId: "DET0826",
      strategyName: "Detection of Gather Victim Host Information",
      analytics: [{ id: "AN1958", description: "Internet scanners may be used to look for patterns associated with malicious content designed to collect host information from visitors.(Citation: ThreatConnect Infrastructure Dec 2020)(Citation: ATT ScanBox) Much of this activity may have a very high occurrence and associated false positive rate, as well as potentially taking place outside the visibility of the target organization, making detection difficult for defenders. Detection efforts may be focused on related stages of the adversary lifecycle, such as during Initial Access." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1596",
    name: "Search Open Technical Databases",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may search freely available technical databases for information about victims that can be used during targeting. Information about victims may be available in online databases and repositories, such as registrations of domains/certificates as well as public collections of network data/artifacts gathered from traffic and/or scans.(Citation: WHOIS)(Citation: DNS Dumpster)(Citation: Circl Passive DNS)(Citation: Medium SSL Cert)(Citation: …",
    detection: {
      strategyId: "DET0860",
      strategyName: "Detection of Search Open Technical Databases",
      analytics: [{ id: "AN1992", description: "Much of this activity may have a very high occurrence and associated false positive rate, as well as potentially taking place outside the visibility of the target organization, making detection difficult for defenders. Detection efforts may be focused on related stages of the adversary lifecycle, such as during Initial Access." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1596.001",
    name: "DNS/Passive DNS",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: true,
    parentId: "T1596",
    description: "Adversaries may search DNS data for information about victims that can be used during targeting. DNS information may include a variety of details, including registered name servers as well as records that outline addressing for a target’s subdomains, mail servers, and other hosts.",
    detection: {
      strategyId: "DET0877",
      strategyName: "Detection of DNS/Passive DNS",
      analytics: [{ id: "AN2009", description: "Much of this activity may have a very high occurrence and associated false positive rate, as well as potentially taking place outside the visibility of the target organization, making detection difficult for defenders. Detection efforts may be focused on related stages of the adversary lifecycle, such as during Initial Access." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1596.002",
    name: "WHOIS",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: true,
    parentId: "T1596",
    description: "Adversaries may search public WHOIS data for information about victims that can be used during targeting. WHOIS data is stored by regional Internet registries (RIR) responsible for allocating and assigning Internet resources such as domain names. Anyone can query WHOIS servers for information about a registered domain, such as assigned IP blocks, contact information, and DNS nameservers.(Citation: WHOIS)",
    detection: {
      strategyId: "DET0832",
      strategyName: "Detection of WHOIS",
      analytics: [{ id: "AN1964", description: "Much of this activity may have a very high occurrence and associated false positive rate, as well as potentially taking place outside the visibility of the target organization, making detection difficult for defenders. Detection efforts may be focused on related stages of the adversary lifecycle, such as during Initial Access." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1597",
    name: "Search Closed Sources",
    tactics: ['reconnaissance'],
    platforms: ["PRE"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may search and gather information about victims from closed (e.g., paid, private, or otherwise not freely available) sources that can be used during targeting. Information about victims may be available for purchase from reputable private sources and databases, such as paid subscriptions to feeds of technical/threat intelligence data. Adversaries may also purchase information from less-reputable sources such as dark web or cybercrime …",
    detection: {
      strategyId: "DET0822",
      strategyName: "Detection of Search Closed Sources",
      analytics: [{ id: "AN1954", description: "Much of this activity may have a very high occurrence and associated false positive rate, as well as potentially taking place outside the visibility of the target organization, making detection difficult for defenders. Detection efforts may be focused on related stages of the adversary lifecycle, such as during Initial Access." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1018",
    name: "Remote System Discovery",
    tactics: ['discovery'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may attempt to get a listing of other systems by IP address, hostname, or other logical identifier on a network that may be used for Lateral Movement from the current system. Functionality could exist within remote access tools to enable this, but utilities available on the operating system could also be used such as [Ping](https://attack.mitre.org/software/S0097), <code>net view</code> using [Net](https://attack.mitre.org/software/S0039), or, …",
    detection: {
      strategyId: "DET0574",
      strategyName: "Detection Strategy for Remote System Enumeration Behavior",
      analytics: [{ id: "AN1583", description: "Execution of network enumeration utilities (e.g., net.exe, ping.exe, tracert.exe) in short succession, often chained with lateral movement tools or system enumeration commands." }, { id: "AN1584", description: "Use of bash scripts or interactive shells to issue sequential ping, arp, or traceroute commands to map remote hosts." }, { id: "AN1585", description: "Execution of built-in or AppleScript-based system enumeration via `arp`, `netstat`, `ping`, and discovery of `/etc/hosts` contents." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1046",
    name: "Network Service Discovery",
    tactics: ['discovery'],
    platforms: ["Containers", "IaaS", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may attempt to get a listing of services running on remote hosts and local network infrastructure devices, including those that may be vulnerable to remote software exploitation. Common methods to acquire this information include port, vulnerability, and/or wordlist scans using tools that are brought onto a system.(Citation: CISA AR21-126A FIVEHANDS May 2021)",
    detection: {
      strategyId: "DET0376",
      strategyName: "Behavioral Detection Strategy for Network Service Discovery Across Platforms",
      analytics: [{ id: "AN1057", description: "Detects processes performing network enumeration (e.g., port scans, service probing) by correlating process creation, socket connections, and sequential destination IP probing within a time window." }, { id: "AN1058", description: "Detects use of network scanning utilities or scripts performing rapid connections to multiple services or hosts using auditd and netflow/pcap telemetry." }, { id: "AN1059", description: "Detects Bonjour-based mDNS enumeration or use of system tools (e.g., dns-sd, nmap) to find active services via multicast probing or targeted scans." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1049",
    name: "System Network Connections Discovery",
    tactics: ['discovery'],
    platforms: ["ESXi", "IaaS", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may attempt to get a listing of network connections to or from the compromised system they are currently accessing or from remote systems by querying for information over the network.",
    detection: {
      strategyId: "DET0320",
      strategyName: "Detection of System Network Connections Discovery Across Platforms",
      analytics: [{ id: "AN0903", description: "Detects usage of commands or binaries (e.g., netstat, PowerShell Get-NetTCPConnection) and WMI or API calls to enumerate local or remote network connections." }, { id: "AN0904", description: "Detects use of netstat, ss, lsof, or custom shell scripts to list current network connections. Often paired with privilege escalation or staging." }, { id: "AN0905", description: "Detects shell-based enumeration of active connections using `netstat`, `lsof -i`, or AppleScript-based system discovery." }],
      moreAnalytics: 3,
    },
  },
  {
    id: "T1057",
    name: "Process Discovery",
    tactics: ['discovery'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may attempt to get information about running processes on a system. Information obtained could be used to gain an understanding of common software/applications running on systems within the network. Administrator or otherwise elevated access may provide better process details. Adversaries may use the information from [Process Discovery](https://attack.mitre.org/techniques/T1057) during automated discovery to shape follow-on behaviors, …",
    detection: {
      strategyId: "DET0034",
      strategyName: "Detection of Adversarial Process Discovery Behavior",
      analytics: [{ id: "AN0095", description: "Identifies adversary behavior that launches commands or invokes APIs to enumerate active processes (e.g., tasklist.exe, Get-Process, or CreateToolhelp32Snapshot). Detects execution combined with parent process lineage, network session context, or remote origin." }, { id: "AN0096", description: "Detects execution of common process enumeration utilities (e.g., ps, top, htop) or access to /proc with suspicious ancestry. Correlates command usage with interactive shell context and user role." }, { id: "AN0097", description: "Monitors execution of ps, top, or launchctl with unusual parent processes or from terminal scripts. Also detects AppleScript-based process listing or `system_profiler SPApplicationsDataType` misuse." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1082",
    name: "System Information Discovery",
    tactics: ['discovery'],
    platforms: ["ESXi", "IaaS", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "An adversary may attempt to get detailed information about the operating system and hardware, including version, patches, hotfixes, service packs, and architecture. Adversaries may use this information to shape follow-on behaviors, including whether or not the adversary fully infects the target and/or attempts specific actions. This behavior is distinct from [Local Storage Discovery](https://attack.mitre.org/techniques/T1680) which is an adversary's …",
    detection: {
      strategyId: "DET0525",
      strategyName: "System Discovery via Native and Remote Utilities",
      analytics: [{ id: "AN1452", description: "Detection of processes executing system environment inspection operations followed by access to OS configuration APIs or registry locations that expose OS version, architecture, patch level, or hardware characteristics. Defenders observe process execution retrieving system configuration metadata immediately after process startup." }, { id: "AN1453", description: "Execution of system enumeration commands such as `uname`, `df`, `uptime`, `hostname`, `lscpu`, and `cat /etc/os-release` through local terminal or scripts." }, { id: "AN1454", description: "Execution of system info utilities like `systemsetup`, `sw_vers`, `uname`, or `sysctl` by terminal or scripted processes." }],
      moreAnalytics: 3,
    },
  },
  {
    id: "T1083",
    name: "File and Directory Discovery",
    tactics: ['discovery'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may enumerate files and directories or may search in specific locations of a host or network share for certain information within a file system. Adversaries may use the information from [File and Directory Discovery](https://attack.mitre.org/techniques/T1083) during automated discovery to shape follow-on behaviors, including whether or not the adversary fully infects the target and/or attempts specific actions.",
    detection: {
      strategyId: "DET0370",
      strategyName: "Recursive Enumeration of Files and Directories Across Privilege Contexts",
      analytics: [{ id: "AN1040", description: "Execution of file enumeration commands (e.g., 'dir', 'tree') from non-standard processes or unusual user contexts, followed by recursive directory traversal or access to sensitive locations." }, { id: "AN1041", description: "Use of file enumeration commands (e.g., 'ls', 'find', 'locate') executed by suspicious users or scripts accessing broad file hierarchies or restricted directories." }, { id: "AN1042", description: "Execution of file or directory discovery commands (e.g., 'ls', 'find') from terminal or script-based tooling, especially outside normal user workflows." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1087",
    name: "Account Discovery",
    tactics: ['discovery'],
    platforms: ["ESXi", "IaaS", "Identity Provider", "Linux", "macOS", "Office Suite", "SaaS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may attempt to get a listing of valid accounts, usernames, or email addresses on a system or within a compromised environment. This information can help adversaries determine which accounts exist, which can aid in follow-on behavior such as brute-forcing, spear-phishing attacks, or account takeovers (e.g., [Valid Accounts](https://attack.mitre.org/techniques/T1078)).",
    detection: {
      strategyId: "DET0587",
      strategyName: "Enumeration of User or Account Information Across Platforms",
      analytics: [{ id: "AN1612", description: "Detection of processes performing local or domain account enumeration by invoking account directory queries or security APIs followed by structured output of account lists. The defender observes command execution or API invocation patterns that retrieve account information and produce enumeration artifacts shortly afterward." }, { id: "AN1613", description: "Enumeration of users and groups through suspicious shell commands or unauthorized access to /etc/passwd or /etc/shadow." }, { id: "AN1614", description: "Detection of account enumeration through directory service queries or system utilities accessing account metadata stores, followed by structured enumeration output." }],
      moreAnalytics: 5,
    },
  },
  {
    id: "T1135",
    name: "Network Share Discovery",
    tactics: ['discovery'],
    platforms: ["Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may look for folders and drives shared on remote systems as a means of identifying sources of information to gather as a precursor for Collection and to identify potential systems of interest for Lateral Movement. Networks often contain shared network drives and folders that enable users to access file directories on various systems across a network.",
    detection: {
      strategyId: "DET0182",
      strategyName: "Behavior-chain detection for T1135 Network Share Discovery across Windows, Linux, and macOS",
      analytics: [{ id: "AN0513", description: "Process or script enumerates network shares via CLI (net view/net share, PowerShell Get-SmbShare/WMI) or OS APIs (NetShareEnum/ srvsvc.NetShareEnumAll RPC) → bursts of outbound SMB/RPC connections (445/139, \\\\host\\IPC$ / srvsvc) to many hosts inside a short window → optional follow-on file listing or copy operations." }, { id: "AN0514", description: "CLI tools (smbclient -L, smbmap, rpcclient, nmblookup) or custom scripts enumerate SMB shares on many internal hosts → corresponding SMB connections (445/139) captured by Zeek/Netflow within a short window." }, { id: "AN0515", description: "Use of native/mac tools (sharing -l, smbutil view, mount_smbfs) or scripts to enumerate SMB shares across many hosts, followed by outbound SMB connections observed in PF/Zeek logs." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1027",
    name: "Obfuscated Files or Information",
    tactics: ['stealth'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may attempt to make an executable or file difficult to discover or analyze by encrypting, encoding, or otherwise obfuscating its contents on the system or in transit. This is common behavior that can be used across different platforms and the network to evade defenses.",
    detection: {
      strategyId: "DET0378",
      strategyName: "Behavioral Detection of Obfuscated Files or Information",
      analytics: [{ id: "AN1064", description: "Correlates script execution or suspicious parent processes with creation or modification of encoded, compressed, or encrypted file formats (e.g., .zip, .7z, .enc) and abnormal command-line syntax or PowerShell obfuscation." }, { id: "AN1065", description: "Detects use of gzip, base64, tar, or openssl in scripts or commands that encode/encrypt files after file staging or system enumeration." }, { id: "AN1066", description: "Monitors use of archive or encryption tools (zip, openssl) tied to user-scripted activity or binaries writing encoded payloads under /Users or /Volumes." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1036",
    name: "Masquerading",
    tactics: ['stealth'],
    platforms: ["Containers", "ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may attempt to manipulate features of their artifacts to make them appear legitimate or benign to users and/or security tools. Masquerading occurs when the name or location of an object, legitimate or malicious, is manipulated or abused for the sake of evading defenses and observation. This may include manipulating file metadata, tricking users into misidentifying the file type, and giving legitimate task or service names.",
    detection: {
      strategyId: "DET0127",
      strategyName: "Behavioral Detection of Masquerading Across Platforms via Metadata and Execution Discrepancy",
      analytics: [{ id: "AN0355", description: "Adversary renames LOLBINs or deploys binaries with spoofed file names, internal PE metadata, or misleading icons to appear legitimate. File creation is followed by execution or service registration inconsistent with known usage." }, { id: "AN0356", description: "Adversary drops renamed binaries in uncommon directories (e.g., /tmp, /dev/shm) or uses special characters in names (e.g., trailing space, Unicode RLO). Execution or cronjob registration follows shortly after file drop." }, { id: "AN0357", description: "Adversary creates disguised launch daemons or apps with misleading names and bundle metadata (e.g., Info.plist values inconsistent with binary path or icon). Launch is correlated with user logon or persistence setup." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1070",
    name: "Indicator Removal",
    tactics: ['stealth'],
    platforms: ["Containers", "ESXi", "Linux", "macOS", "Network Devices", "Office Suite", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may selectively delete or modify artifacts generated to reduce indications of their presence and blend in with legitimate activity. Rather than broadly removing evidence, adversaries may target specific artifacts that appear anomalous or are likely to draw scrutiny, while leaving sufficient data intact to maintain the appearance of normal system behavior.",
    detection: {
      strategyId: "DET0184",
      strategyName: "Behavioral Detection of Indicator Removal Across Platforms",
      analytics: [{ id: "AN0520", description: "Monitors sequences involving deletion/modification of logs, registry keys, scheduled tasks, or prefetch files following suspicious process activity or elevated access escalation." }, { id: "AN0521", description: "Detects deletion or overwriting of bash history, syslog, audit logs, and .ssh metadata following privilege elevation or suspicious process spawning." }, { id: "AN0522", description: "Detects clearing of unified logs, deletion of plist files tied to persistence, and manipulation of Terminal history after initial execution." }],
      moreAnalytics: 3,
    },
  },
  {
    id: "T1070.004",
    name: "File Deletion",
    tactics: ['stealth'],
    platforms: ["ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: true,
    parentId: "T1070",
    description: "Adversaries may delete files left behind by the actions of their intrusion activity. Malware, tools, or other non-native files dropped or created on a system by an adversary (ex: [Ingress Tool Transfer](https://attack.mitre.org/techniques/T1105)) may leave traces to indicate to what was done within a network and how. Removal of these files can occur during an intrusion, or as part of a post-intrusion process to minimize the adversary's footprint.",
    detection: {
      strategyId: "DET0140",
      strategyName: "Behavioral Detection of Malicious File Deletion",
      analytics: [{ id: "AN0392", description: "Detects adversary behavior deleting artifacts (e.g., dropped payloads, evidence files) using native or external utilities (e.g., del, erase, SDelete). Detects deletion events correlated with unusual process lineage or timing post-execution." }, { id: "AN0393", description: "Detects deletion of suspicious files (e.g., payloads, temp exes, scripts) via `rm`, `unlink`, or secure deletion tools like `shred`, especially when performed by unexpected users or shortly after execution." }, { id: "AN0394", description: "Detects removal of adversary artifacts via `rm`, `unlink`, or secure tools, with focus on shell sessions, temp files, and modified LaunchAgents or system directories." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1070.006",
    name: "Timestomp",
    tactics: ['stealth'],
    platforms: ["ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: true,
    parentId: "T1070",
    description: "Adversaries may modify file time attributes to hide new files or changes to existing files. Timestomping is a technique that modifies the timestamps of a file (the modify, access, create, and change times), often to mimic files that are in the same folder and blend malicious files with legitimate files.",
    detection: {
      strategyId: "DET0591",
      strategyName: "Cross-Platform Behavioral Detection of File Timestomping via Metadata Tampering",
      analytics: [{ id: "AN1626", description: "Detects attempts to modify file timestamps via API usage (e.g., `SetFileTime`), CLI tools (e.g., `w32tm`, PowerShell), or double-timestomp behavior where $SI and $FN timestamps are mismatched or reverted." }, { id: "AN1627", description: "Detects use of timestamp-altering commands like `touch -a -m -t` or `touch -r`, particularly when executed by unusual users or in suspicious directories." }, { id: "AN1628", description: "Detects timestamp changes using `touch`, `SetFile`, or direct metadata tampering (e.g., xattr manipulation) from Terminal, scripts, or low-level APIs." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1497",
    name: "Virtualization/Sandbox Evasion",
    tactics: ['discovery', 'stealth'],
    platforms: ["Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may employ various means to detect and avoid virtualization and analysis environments. This may include changing behaviors based on the results of checks for the presence of artifacts indicative of a virtual machine environment (VME) or sandbox. If the adversary detects a VME, they may alter their malware to disengage from the victim or conceal the core functions of the implant. They may also search for VME artifacts before dropping secondary …",
    detection: {
      strategyId: "DET0046",
      strategyName: "Detection Strategy for T1497 Virtualization/Sandbox Evasion",
      analytics: [{ id: "AN0127", description: "Execution of discovery commands or API calls for virtualization artifacts (e.g., registry keys, device drivers, services), sleep/skipped execution behavior, or sandbox evasion DLLs before payload deployment." }, { id: "AN0128", description: "Execution of commands to enumerate virtualization-related files or processes (e.g., '/sys/class/dmi/id/product_name', dmesg, lscpu, lspci), or querying hypervisor interfaces prior to malware execution." }, { id: "AN0129", description: "Execution of scripts or binaries that check for virtualization indicators (e.g., system_profiler, ioreg -l, kextstat), combined with delay functions or anomalous launchd activity." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1008",
    name: "Fallback Channels",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may use fallback or alternate communication channels if the primary channel is compromised or inaccessible in order to maintain reliable command and control and to avoid data transfer thresholds.",
    detection: {
      strategyId: "DET0499",
      strategyName: "Behavioral Detection of Fallback or Alternate C2 Channels",
      analytics: [{ id: "AN1376", description: "Establishing network connections on uncommon ports or protocols following C2 disruption or blocking. Often executed by processes that typically exhibit no network activity." }, { id: "AN1377", description: "Creation of outbound connections on alternate ports or using covert transport (e.g., ICMP, DNS) from non-network-intensive processes, following known disruption or blocked traffic." }, { id: "AN1378", description: "Outbound fallback traffic from low-profile or background launch agents using unusual protocols or destinations after primary channel inactivity." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1071",
    name: "Application Layer Protocol",
    tactics: ['command-and-control'],
    platforms: ["Linux", "macOS", "Windows", "Network Devices", "ESXi"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may communicate using OSI application layer protocols to avoid detection/network filtering by blending in with existing traffic. Commands to the remote system, and often the results of those commands, will be embedded within the protocol traffic between the client and server.",
    detection: {
      strategyId: "DET0444",
      strategyName: "Detection of Command and Control Over Application Layer Protocols",
      analytics: [{ id: "AN1225", description: "Detects suspicious usage of common application-layer protocols (e.g., HTTP, HTTPS, DNS, SMB) by abnormal processes, with high outbound byte counts or irregular ports, possibly indicating command and control or data exfiltration." }, { id: "AN1226", description: "Detects suspicious curl, wget, or custom socket traffic that leverages DNS, HTTPS, or IRC-style protocols with unbalanced traffic or beacon-like intervals." }, { id: "AN1227", description: "Detects applications using abnormal protocols or high volume traffic not previously associated with the process image, such as Automator or AppleScript invoking curl or python sockets." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1071.001",
    name: "Web Protocols",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: true,
    parentId: "T1071",
    description: "Adversaries may communicate using application layer protocols associated with web traffic to avoid detection/network filtering by blending in with existing traffic. Commands to the remote system, and often the results of those commands, will be embedded within the protocol traffic between the client and server.",
    detection: {
      strategyId: "DET0027",
      strategyName: "Detection of Web Protocol-Based C2 Over HTTP, HTTPS, or WebSockets",
      analytics: [{ id: "AN0075", description: "Detects unexpected or high-volume HTTP/S/WebSocket communication from suspicious processes (e.g., PowerShell, rundll32) using uncommon user agents or mimicking browser traffic to unusual domains or IPs." }, { id: "AN0076", description: "Detects curl, wget, Python requests, or custom HTTP clients communicating over non-standard ports, with repetitive or beacon-like patterns or POST-heavy behavior to rare domains." }, { id: "AN0077", description: "Detects applications such as Automator, AppleScript, or LaunchDaemons invoking HTTP/S traffic to non-standard domains or using suspicious headers (e.g., Base64 in URIs or cookie fields)." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1071.004",
    name: "DNS",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: true,
    parentId: "T1071",
    description: "Adversaries may communicate using the Domain Name System (DNS) application layer protocol to avoid detection/network filtering by blending in with existing traffic. Commands to the remote system, and often the results of those commands, will be embedded within the protocol traffic between the client and server.",
    detection: {
      strategyId: "DET0400",
      strategyName: "Behavioral Detection of DNS Tunneling and Application Layer Abuse",
      analytics: [{ id: "AN1121", description: "Detects high-frequency or anomalous DNS queries initiated by non-browser, non-system processes (e.g., PowerShell, rundll32, python.exe) used to establish command and control via DNS tunneling." }, { id: "AN1122", description: "Detects local daemons or scripts generating outbound DNS queries with long or frequent subdomains, indicative of DNS tunneling via tools like `iodine`, `dnscat2`, or `dig` from cronjobs or reverse shells." }, { id: "AN1123", description: "Detects scripting environments (AppleScript, osascript, curl) or non-native tools performing DNS queries with encoded subdomains, often used for data exfiltration or beaconing." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1090",
    name: "Proxy",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may use a connection proxy to direct network traffic between systems or act as an intermediary for network communications to a command and control server to avoid direct connections to their infrastructure. Many tools exist that enable traffic redirection through proxies or port redirection, including [HTRAN](https://attack.mitre.org/software/S0040), ZXProxy, and ZXPortMap. (Citation: Trend Micro APT Attack Tools) Adversaries use these types …",
    detection: {
      strategyId: "DET0445",
      strategyName: "Detection of Proxy Infrastructure Setup and Traffic Bridging",
      analytics: [{ id: "AN1229", description: "Suspicious process spawning (e.g., `rundll32`, `svchost`, `powershell`, or `netsh`) followed by network connection creation to internal hosts or uncommon external endpoints on high or non-standard ports." }, { id: "AN1230", description: "User-space tools (e.g., `socat`, `ncat`, `iptables`, `ssh`) used in non-standard ways to establish reverse shells, port-forwarding, or inter-host connections. Often chained with uncommon outbound destinations or SSH tunnels." }, { id: "AN1231", description: "AppleScript, LaunchAgents, or remote login services (`ssh`, `networksetup`) establishing proxy tunnels or dynamic port forwards to external IPs or alternate local hosts." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1090.001",
    name: "Internal Proxy",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: true,
    parentId: "T1090",
    description: "Adversaries may use an internal proxy to direct command and control traffic between two or more systems in a compromised environment. Many tools exist that enable traffic redirection through proxies or port redirection, including [HTRAN](https://attack.mitre.org/software/S0040), ZXProxy, and ZXPortMap. (Citation: Trend Micro APT Attack Tools) Adversaries use internal proxies to manage command and control communications inside a compromised environment, to …",
    detection: {
      strategyId: "DET0075",
      strategyName: "Internal Proxy Behavior via Lateral Host-to-Host C2 Relay",
      analytics: [{ id: "AN0204", description: "Anomalous process (e.g., `rundll32`, `svchost`, `cmd`) initiates connections to internal peer hosts not seen in typical communication baselines, used to proxy or forward traffic internally, often using SMB, RPC, or high ports." }, { id: "AN0205", description: "`socat`, `ssh`, `iptables`, or `ncat` invoked from user space or cron jobs to create port forwarding, reverse shells, or inter-host tunnels between compromised Linux systems. Behavior is typically paired with socket activity and high entropy traffic." }, { id: "AN0206", description: "Execution of AppleScript or Automator services launching `ssh -L`, `socat`, or `launchctl` items that dynamically reroute traffic from one Mac endpoint to another. LaunchAgents used to establish permanent internal tunnels." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1090.002",
    name: "External Proxy",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: true,
    parentId: "T1090",
    description: "Adversaries may use an external proxy to act as an intermediary for network communications to a command and control server to avoid direct connections to their infrastructure. Many tools exist that enable traffic redirection through proxies or port redirection, including [HTRAN](https://attack.mitre.org/software/S0040), ZXProxy, and ZXPortMap. (Citation: Trend Micro APT Attack Tools) Adversaries use these types of proxies to manage command and control …",
    detection: {
      strategyId: "DET0325",
      strategyName: "External Proxy Behavior via Outbound Relay to Intermediate Infrastructure",
      analytics: [{ id: "AN0922", description: "Unusual process (e.g., `rundll32`, `mshta`, `wscript`, or custom payloads) initiates network connection to external IPs/domains that proxy C2 traffic, often over uncommon ports or high entropy HTTP/S connections." }, { id: "AN0923", description: "`curl`, `wget`, `ncat`, `socat`, or custom binaries initiate outbound traffic to Internet-based proxies (e.g., via VPS or CDN). Behavior may include reverse shell constructs or persistent outbound beacons." }, { id: "AN0924", description: "AppleScript or terminal sessions launch tools (`curl`, `nc`, `ssh`) to external IPs not commonly accessed. Outbound connections are made by LaunchAgents/LaunchDaemons, often masquerading as system services." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1090.003",
    name: "Multi-hop Proxy",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: true,
    parentId: "T1090",
    description: "Adversaries may chain together multiple proxies to disguise the source of malicious traffic. Typically, a defender will be able to identify the last proxy traffic traversed before it enters their network; the defender may or may not be able to identify any previous proxies before the last-hop proxy. This technique makes identifying the original source of the malicious traffic even more difficult by requiring the defender to trace malicious traffic through …",
    detection: {
      strategyId: "DET0359",
      strategyName: "Multi-hop Proxy Behavior via Relay Node Chaining, Onion Routing, and Network Tunneling",
      analytics: [{ id: "AN1020", description: "Suspicious processes (e.g., Tor clients, relays, unknown binaries) launch with sustained encrypted outbound traffic to known anonymity infrastructure (e.g., Tor, I2P), and may relay to additional internal systems via reverse proxying, ICMP tunneling, or socket forwarding." }, { id: "AN1021", description: "Tools such as `tor`, `nglite`, `proxychains`, `chisel`, or custom daemons repeatedly initiate outbound sessions to multiple nodes before final destination. This behavior is abnormal for Linux services outside of VPN, monitoring, or CDN relay contexts." }, { id: "AN1022", description: "LaunchAgents or LaunchDaemons initiate persistent Tor or relay processes that make encrypted outbound connections. May be paired with sandbox bypasses or unsigned executables communicating over SOCKS proxies." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1090.004",
    name: "Domain Fronting",
    tactics: ['command-and-control'],
    platforms: ["Linux", "macOS", "Windows", "ESXi"],
    isSubTechnique: true,
    parentId: "T1090",
    description: "Adversaries may take advantage of routing schemes in Content Delivery Networks (CDNs) and other services which host multiple domains to obfuscate the intended destination of HTTPS traffic or traffic tunneled through HTTPS. (Citation: Fifield Blocking Resistent Communication through domain fronting 2015) Domain fronting involves using different domain names in the SNI field of the TLS header and the Host field of the HTTP header. If both domains are served …",
    detection: {
      strategyId: "DET0196",
      strategyName: "Domain Fronting Behavior via Mismatched TLS SNI and HTTP Host Headers",
      analytics: [{ id: "AN0564", description: "Suspicious outbound HTTPS connections where the TLS Server Name Indication (SNI) does not match the HTTP Host header, indicating potential use of domain fronting to mask C2 traffic via CDNs." }, { id: "AN0565", description: "Applications such as `curl`, `wget`, or custom binaries initiate HTTPS connections where the TLS SNI is mismatched or absent while HTTP Host targets CDN-available C2 endpoints." }, { id: "AN0566", description: "Unsigned or user-space apps initiate TLS connections with one hostname and HTTP headers requesting a different domain, commonly abused in CDN-resident domain fronting techniques." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1095",
    name: "Non-Application Layer Protocol",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may use an OSI non-application layer protocol for communication between host and C2 server or among infected hosts within a network. The list of possible protocols is extensive.(Citation: Wikipedia OSI) Specific examples include use of network layer protocols, such as the Internet Control Message Protocol (ICMP), transport layer protocols, such as the User Datagram Protocol (UDP), session layer protocols, such as Socket Secure (SOCKS), as well …",
    detection: {
      strategyId: "DET0457",
      strategyName: "Detection of Non-Application Layer Protocols for C2",
      analytics: [{ id: "AN1254", description: "Anomalous use of ICMP or UDP by non-network service processes for data exfiltration or remote control, especially if traffic bypasses proxy infrastructure or shows unusual flow patterns." }, { id: "AN1255", description: "ICMP or raw socket traffic generated by user-mode processes like bash, Python, or nc, typically using `ping`, `hping3`, or crafted packets via libpcap or scapy." }, { id: "AN1256", description: "Unsigned binaries or interpreted scripts initiating non-standard protocols (ICMP, UDP, SOCKS) outside of baseline network behavior." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1105",
    name: "Ingress Tool Transfer",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may transfer tools or other files from an external system into a compromised environment. Tools or files may be copied from an external adversary-controlled system to the victim network through the command and control channel or through alternate protocols such as [ftp](https://attack.mitre.org/software/S0095). Once present, adversaries may also transfer/spread tools between victim devices within a compromised environment (i.e. [Lateral Tool …",
    detection: {
      strategyId: "DET0060",
      strategyName: "Detect Ingress Tool Transfers via Behavioral Chain",
      analytics: [{ id: "AN0165", description: "Unusual or uncommon processes initiate network connections to external destinations followed by file creation (tools downloaded)." }, { id: "AN0166", description: "Shell-based tools (curl, wget, scp) initiate connections to external domains followed by creation of executable files on disk." }, { id: "AN0167", description: "Process execution of curl or wget followed by a network connection and a file created in temporary or user-specific directories." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1132",
    name: "Data Encoding",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may encode data to make the content of command and control traffic more difficult to detect. Command and control (C2) information can be encoded using a standard data encoding system. Use of data encoding may adhere to existing protocol specifications and includes use of ASCII, Unicode, Base64, MIME, or other binary-to-text and character encoding systems.(Citation: Wikipedia Binary-to-text Encoding) (Citation: Wikipedia Character Encoding) …",
    detection: {
      strategyId: "DET0108",
      strategyName: "Detection Strategy for Data Encoding in C2 Channels",
      analytics: [{ id: "AN0302", description: "Atypical processes (e.g., powershell.exe, regsvr32.exe) encode large outbound traffic using Base64 or other character encodings; this traffic is sent over uncommon ports or embedded in protocol fields (e.g., HTTP cookies or headers)." }, { id: "AN0303", description: "Custom scripts or processes encode outbound traffic using gzip, Base64, or hex prior to exfiltration via curl, wget, or custom sockets. Encoding typically occurs before or during outbound connections from non-network daemons." }, { id: "AN0304", description: "Processes use built-in encoding utilities (e.g., `base64`, `xxd`, or `plutil`) to encode file contents followed by HTTP/HTTPS transfer via curl or custom applications." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1571",
    name: "Non-Standard Port",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may communicate using a protocol and port pairing that are typically not associated. For example, HTTPS over port 8088(Citation: Symantec Elfin Mar 2019) or port 587(Citation: Fortinet Agent Tesla April 2018) as opposed to the traditional port 443. Adversaries may make changes to the standard port used by a protocol to bypass filtering or muddle analysis/parsing of network data.",
    detection: {
      strategyId: "DET0227",
      strategyName: "Detection Strategy for Non-Standard Ports",
      analytics: [{ id: "AN0633", description: "Processes initiating outbound connections on uncommon ports or using protocols inconsistent with the assigned port. Correlating process creation with subsequent network connections reveals anomalies such as svchost.exe or Office applications using high, atypical ports." }, { id: "AN0634", description: "Unusual daemons or user processes binding/listening on ports outside of standard ranges, or initiating client connections using mismatched protocol/port pairings." }, { id: "AN0635", description: "Applications making outbound connections on non-standard ports or launchd services bound to ports inconsistent with system baselines." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1572",
    name: "Protocol Tunneling",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may tunnel network communications to and from a victim system within a separate protocol to avoid detection/network filtering and/or enable access to otherwise unreachable systems. Tunneling involves explicitly encapsulating a protocol within another. This behavior may conceal malicious traffic by blending in with existing traffic and/or provide an outer layer of encryption (similar to a VPN). Tunneling could also enable routing of network …",
    detection: {
      strategyId: "DET0538",
      strategyName: "Detection Strategy for Protocol Tunneling accross OS platforms.",
      analytics: [{ id: "AN1483", description: "Processes such as plink.exe, ssh.exe, or netsh.exe establishing outbound network connections where traffic patterns show encapsulated protocols (e.g., RDP over SSH). Defender observations include anomalous process-to-network relationships, large asymmetric data flows, and port usage mismatches." }, { id: "AN1484", description: "sshd, socat, or custom binaries initiating port forwarding or encapsulating traffic (e.g., RDP, SMB) through SSH or HTTP. Defender sees abnormal connect/bind syscalls, encrypted traffic on ports typically used for non-encrypted services, and outlier traffic volume patterns." }, { id: "AN1485", description: "launchd or user-invoked processes (ssh, socat) encapsulating traffic via SSH tunnels, VPN-style tooling, or DNS-over-HTTPS clients. Defender sees outbound TLS traffic with embedded DNS or RDP payloads." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1573",
    name: "Encrypted Channel",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may employ an encryption algorithm to conceal command and control traffic rather than relying on any inherent protections provided by a communication protocol. Despite the use of a secure algorithm, these implementations may be vulnerable to reverse engineering if secret keys are encoded and/or generated within malware samples/configuration files.",
    detection: {
      strategyId: "DET0273",
      strategyName: "Detection Strategy for Encrypted Channel across OS Platforms",
      analytics: [{ id: "AN0759", description: "Processes that normally do not initiate network connections establishing outbound encrypted TLS/SSL sessions, especially with asymmetric traffic volumes (client sending more than receiving) or non-standard certificate chains. Defender observations correlate process creation with unexpected network encryption libraries being loaded." }, { id: "AN0760", description: "Processes like curl, wget, python, socat, or custom binaries initiating TLS/SSL sessions to non-standard destinations. Defender sees abnormal syscalls for connect(), loading of libssl libraries, and persistent outbound encrypted traffic from daemons not normally communicating externally." }, { id: "AN0761", description: "Applications or launchd jobs initiating encrypted TLS traffic to rare external hosts. Defender observes unified logs showing ssl/TLS API calls by processes not baseline-approved, and payload entropy suggesting encrypted C2 sessions." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1573.001",
    name: "Symmetric Cryptography",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: true,
    parentId: "T1573",
    description: "Adversaries may employ a known symmetric encryption algorithm to conceal command and control traffic rather than relying on any inherent protections provided by a communication protocol. Symmetric encryption algorithms use the same key for plaintext encryption and ciphertext decryption. Common symmetric encryption algorithms include AES, DES, 3DES, Blowfish, and RC4.",
    detection: {
      strategyId: "DET0143",
      strategyName: "Detection Strategy for Encrypted Channel via Symmetric Cryptography across OS Platforms",
      analytics: [{ id: "AN0400", description: "Processes that typically do not perform cryptographic operations loading symmetric encryption libraries (e.g., bcryptprimitives.dll, aes.dll), then initiating outbound connections with high-entropy payloads. Defender correlates process creation, DLL load, and anomalous encrypted traffic patterns." }, { id: "AN0401", description: "Unexpected processes (e.g., bash, python, custom binaries) dynamically loading libcrypto or performing AES/RC4 encryption operations, then initiating outbound sessions with abnormal byte entropy or asymmetric traffic patterns." }, { id: "AN0402", description: "Launchd jobs or user processes invoking symmetric crypto APIs from the Security framework and generating outbound connections carrying randomized payloads inconsistent with normal TLS patterns." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1573.002",
    name: "Asymmetric Cryptography",
    tactics: ['command-and-control'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: true,
    parentId: "T1573",
    description: "Adversaries may employ a known asymmetric encryption algorithm to conceal command and control traffic rather than relying on any inherent protections provided by a communication protocol. Asymmetric cryptography, also known as public key cryptography, uses a keypair per party: one public that can be freely distributed, and one private. Due to how the keys are generated, the sender encrypts data with the receiver’s public key and the receiver decrypts the …",
    detection: {
      strategyId: "DET0543",
      strategyName: "Detection Strategy for Encrypted Channel via Asymmetric Cryptography across OS Platforms",
      analytics: [{ id: "AN1496", description: "Processes not typically associated with encryption loading asymmetric crypto libraries (e.g., rsaenh.dll, crypt32.dll) and subsequently initiating outbound TLS/SSL connections with abnormal certificate chains or handshakes. Defender correlates process creation, module load, and unusual encrypted sessions." }, { id: "AN1497", description: "Processes (e.g., bash, python, custom binaries) dynamically linking libcrypto/libssl for RSA key exchange, then creating external connections with abnormal certificate validation or handshake anomalies. Defender observes syscall traces and outbound asymmetric key exchanges from non-SSL-native processes." }, { id: "AN1498", description: "Applications or launchd services invoking RSA or public-key routines from the Security framework, followed by outbound SSL/TLS sessions with unrecognized certs or anomalous handshakes. Defender observes unified logs of API calls and suspicious network entropy." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1005",
    name: "Data from Local System",
    tactics: ['collection'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may search local system sources, such as file systems, configuration files, local databases, virtual machine files, or process memory, to find files of interest and sensitive data prior to Exfiltration.",
    detection: {
      strategyId: "DET0380",
      strategyName: "Detection of Local Data Collection Prior to Exfiltration",
      analytics: [{ id: "AN1070", description: "Adversaries collecting local files via PowerShell, WMI, or direct file API calls often include recursive file listings, targeted file reads, and temporary file staging." }, { id: "AN1071", description: "Adversaries using bash scripts or tools to recursively enumerate user home directories, config files, or SSH keys." }, { id: "AN1072", description: "Adversary use of bash/zsh or AppleScript to locate files and exfil targets like user keychains or documents." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1039",
    name: "Data from Network Shared Drive",
    tactics: ['collection'],
    platforms: ["Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may search network shares on computers they have compromised to find files of interest. Sensitive data can be collected from remote systems via shared network drives (host shared directory, network file server, etc.) that are accessible from the current system prior to Exfiltration. Interactive command shells may be in use, and common functionality within [cmd](https://attack.mitre.org/software/S0106) may be used to gather information.",
    detection: {
      strategyId: "DET0410",
      strategyName: "Detection Strategy for Data from Network Shared Drive",
      analytics: [{ id: "AN1145", description: "Monitoring of file access to network shares (e.g., C$, Admin$) followed by unusual read or copy operations by processes not typically associated with such activity (e.g., PowerShell, certutil)." }, { id: "AN1146", description: "Unusual access or copying of files from mounted network drives (e.g., NFS, CIFS/SMB) by user shells or scripts followed by large data transfer." }, { id: "AN1147", description: "Detection of file access from mounted SMB shares followed by copy or exfil commands from Terminal or script interpreter processes." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1074",
    name: "Data Staged",
    tactics: ['collection'],
    platforms: ["ESXi", "IaaS", "Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may stage collected data in a central location or directory prior to Exfiltration. Data may be kept in separate files or combined into one file through techniques such as [Archive Collected Data](https://attack.mitre.org/techniques/T1560). Interactive command shells may be used, and common functionality within [cmd](https://attack.mitre.org/software/S0106) and bash may be used to copy data into a staging location.(Citation: PWC Cloud Hopper …",
    detection: {
      strategyId: "DET0014",
      strategyName: "Detection of Data Staging Prior to Exfiltration",
      analytics: [{ id: "AN0040", description: "Detects staging of sensitive files into temporary or public directories, compression with 7zip/WinRAR, or batch copy prior to exfiltration." }, { id: "AN0041", description: "Detects script or user activity copying files to a central temp or /mnt directory followed by archive/compression utilities." }, { id: "AN0042", description: "Detects files collected into user temp or shared directories followed by compression with ditto, zip, or custom scripts." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1074.001",
    name: "Local Data Staging",
    tactics: ['collection'],
    platforms: ["ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: true,
    parentId: "T1074",
    description: "Adversaries may stage collected data in a central location or directory on the local system prior to Exfiltration. Data may be kept in separate files or combined into one file through techniques such as [Archive Collected Data](https://attack.mitre.org/techniques/T1560). Interactive command shells may be used, and common functionality within [cmd](https://attack.mitre.org/software/S0106) and bash may be used to copy data into a staging location.",
    detection: {
      strategyId: "DET0261",
      strategyName: "Detection of Local Data Staging Prior to Exfiltration",
      analytics: [{ id: "AN0724", description: "Detects file reads across locations followed by writes to temp or staging directories, often compressed or encrypted, indicating local staging behavior." }, { id: "AN0725", description: "Detects aggregation of files from different directories into /tmp, /mnt, or user-specified directories with archiving tools like tar or gzip." }, { id: "AN0726", description: "Detects staged data aggregated in /Users/Shared, /private/tmp with compression tools like ditto or zip, initiated via Terminal or AppleScript." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1560",
    name: "Archive Collected Data",
    tactics: ['collection'],
    platforms: ["Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "An adversary may compress and/or encrypt data that is collected prior to exfiltration. Compressing the data can help to obfuscate the collected data and minimize the amount of data sent over the network.(Citation: DOJ GRU Indictment Jul 2018) Encryption can be used to hide information that is being exfiltrated from detection or make exfiltration less conspicuous upon inspection by a defender.",
    detection: {
      strategyId: "DET0526",
      strategyName: "Detect Archiving and Encryption of Collected Data (T1560)",
      analytics: [{ id: "AN1458", description: "Detects adversarial archiving of files prior to exfiltration by correlating execution of compression/encryption utilities (e.g., makecab.exe, rar.exe, 7z.exe, powershell Compress-Archive) with subsequent creation of large compressed or encrypted files. Identifies abnormal process lineage involving crypt32.dll usage, command-line arguments invoking compression switches, and file write operations to temporary or staging directories." }, { id: "AN1459", description: "Detects adversarial archiving activity through invocation of utilities like tar, gzip, bzip2, or openssl used in non-administrative or unusual contexts. Correlates command execution patterns with file creation of compressed/encrypted outputs in staging directories (e.g., /tmp, /var/tmp)." }, { id: "AN1460", description: "Detects use of macOS-native archiving or encryption tools (zip, ditto, hdiutil) for staging collected data. Identifies unexpected invocation of archive utilities by Office apps, browsers, or background daemons. Correlates file creation of .zip/.dmg containers with process lineage anomalies." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1560.001",
    name: "Archive via Utility",
    tactics: ['collection'],
    platforms: ["Linux", "macOS", "Windows"],
    isSubTechnique: true,
    parentId: "T1560",
    description: "Adversaries may use utilities to compress and/or encrypt collected data prior to exfiltration. Many utilities include functionalities to compress, encrypt, or otherwise package data into a format that is easier/more secure to transport.",
    detection: {
      strategyId: "DET0298",
      strategyName: "Detect Archiving via Utility (T1560.001)",
      analytics: [{ id: "AN0831", description: "Detects adversarial archiving using built-in or third-party utilities (makecab, diantz, xcopy, certutil, 7z, WinRAR, WinZip). Correlates suspicious process creation events with command-line arguments for compression/encoding, followed by creation of archive files (.cab, .zip, .7z, .rar). Identifies anomalous loading of crypt32.dll for encryption operations or execution of diantz.exe to compress remotely staged files." }, { id: "AN0832", description: "Detects execution of archiving utilities (tar, gzip, bzip2, xz, zip, openssl) followed by suspicious archive file creation. Correlates archive creation in temporary or staging directories with execution of commands involving compression or encryption options." }, { id: "AN0833", description: "Detects invocation of macOS-native archiving utilities (zip, ditto, hdiutil) or openssl used for encryption. Correlates execution with archive or encrypted file creation (.zip, .dmg, .tar.gz) in user or temporary directories. Identifies anomalous use of archiving commands by Office applications or daemons." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1020",
    name: "Automated Exfiltration",
    tactics: ['exfiltration'],
    platforms: ["Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may exfiltrate data, such as sensitive documents, through the use of automated processing after being gathered during Collection.(Citation: ESET Gamaredon June 2020)",
    detection: {
      strategyId: "DET0397",
      strategyName: "Automated Exfiltration Detection Strategy",
      analytics: [{ id: "AN1113", description: "Detection of automated tools or scripts periodically transmitting data to external destinations using scheduled tasks or background processes." }, { id: "AN1114", description: "Background scripts (e.g., via cron) or daemons transmitting data repeatedly to remote IPs or URLs." }, { id: "AN1115", description: "Observation of LaunchAgents or LaunchDaemons establishing periodic external connections indicative of automated data transfer." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1029",
    name: "Scheduled Transfer",
    tactics: ['exfiltration'],
    platforms: ["Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may schedule data exfiltration to be performed only at certain times of day or at certain intervals. This could be done to blend traffic patterns with normal activity or availability.",
    detection: {
      strategyId: "DET0399",
      strategyName: "Detection Strategy for Scheduled Transfer and Recurrent Exfiltration Patterns",
      analytics: [{ id: "AN1118", description: "Recurring network exfiltration initiated by scheduled or script-based processes exhibiting time-based regularity and consistent external destinations." }, { id: "AN1119", description: "Detection of cron-based or script-based recurring transfers where the same script, user, or destination reappears at predictable intervals." }, { id: "AN1120", description: "LaunchAgent or launchd recurring jobs initiating data transfer to consistent external IPs or domains with repeat timing signatures." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1030",
    name: "Data Transfer Size Limits",
    tactics: ['exfiltration'],
    platforms: ["Linux", "macOS", "Windows", "ESXi"],
    isSubTechnique: false,
    parentId: null,
    description: "An adversary may exfiltrate data in fixed size chunks instead of whole files or limit packet sizes below certain thresholds. This approach may be used to avoid triggering network data transfer threshold alerts.",
    detection: {
      strategyId: "DET0213",
      strategyName: "Detection Strategy for Data Transfer Size Limits and Chunked Exfiltration",
      analytics: [{ id: "AN0596", description: "Adversary uses a process to establish outbound connections that transmit uniform packet sizes at a consistent interval, avoiding threshold-based network alerts." }, { id: "AN0597", description: "Outbound connections from non-network-facing processes repeatedly send similarly sized payloads within uniform time intervals." }, { id: "AN0598", description: "Processes on macOS initiate external connections that consistently transmit data in fixed sizes using LaunchAgents or unexpected users." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1041",
    name: "Exfiltration Over C2 Channel",
    tactics: ['exfiltration'],
    platforms: ["ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may steal data by exfiltrating it over an existing command and control channel. Stolen data is encoded into the normal communications channel using the same protocol as command and control communications.",
    detection: {
      strategyId: "DET0348",
      strategyName: "Detection Strategy for Exfiltration Over C2 Channel",
      analytics: [{ id: "AN0988", description: "Identifies suspicious outbound traffic volume mismatches from processes that typically do not generate network activity, particularly over C2 protocols like HTTPS, DNS, or custom TCP/UDP ports, following file or data access." }, { id: "AN0989", description: "Monitors for processes reading sensitive files then immediately initiating unusual outbound connections or bulk transfer sessions over persistent sockets, particularly with encrypted or binary payloads." }, { id: "AN0990", description: "Detects unauthorized applications or scripts accessing sensitive data followed by establishing encrypted outbound communication to rare external destinations or with abnormal byte ratios." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1048",
    name: "Exfiltration Over Alternative Protocol",
    tactics: ['exfiltration'],
    platforms: ["ESXi", "IaaS", "Linux", "macOS", "Network Devices", "Office Suite", "SaaS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may steal data by exfiltrating it over a different protocol than that of the existing command and control channel. The data may also be sent to an alternate network location from the main command and control server.",
    detection: {
      strategyId: "DET0131",
      strategyName: "Behavioral Detection Strategy for Exfiltration Over Alternative Protocol",
      analytics: [{ id: "AN0367", description: "Detects unusual outbound file transfer behavior using protocols like FTP, SMB, SMTP, or DNS, involving non-standard processes, off-hour activity, or uncommonly high volume." }, { id: "AN0368", description: "Detects file exfiltration using tools like curl, scp, or custom binaries over protocols such as FTP, HTTP/S, or DNS tunneling, especially outside baseline user behavior." }, { id: "AN0369", description: "Detects non-native file transfer via curl, Python scripts, or AppleScript using uncommon protocols like FTP, SMTP, or DNS exfiltration through mDNSResponder abuse." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1048.001",
    name: "Exfiltration Over Symmetric Encrypted Non-C2 Protocol",
    tactics: ['exfiltration'],
    platforms: ["Linux", "macOS", "Windows", "ESXi"],
    isSubTechnique: true,
    parentId: "T1048",
    description: "Adversaries may steal data by exfiltrating it over a symmetrically encrypted network protocol other than that of the existing command and control channel. The data may also be sent to an alternate network location from the main command and control server.",
    detection: {
      strategyId: "DET0503",
      strategyName: "Behavioral Detection Strategy for Exfiltration Over Symmetric Encrypted Non-C2 Protocol",
      analytics: [{ id: "AN1389", description: "Detects the execution of non-browser processes establishing outbound encrypted network connections using uncommon symmetric encryption protocols (e.g., AES via PowerShell or custom scripts) to alternate external destinations." }, { id: "AN1390", description: "Detects command-line utilities or scripts using encryption libraries or symmetric algorithms (e.g., OpenSSL AES, GPG, Python + PyCrypto) in conjunction with outbound file transfers or traffic to external destinations." }, { id: "AN1391", description: "Detects symmetric key-based encryption operations (e.g., AES via Python, AppleScript, or OpenSSL) followed by unusual outbound connections from non-browser applications or scripted tools." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1048.002",
    name: "Exfiltration Over Asymmetric Encrypted Non-C2 Protocol",
    tactics: ['exfiltration'],
    platforms: ["ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: true,
    parentId: "T1048",
    description: "Adversaries may steal data by exfiltrating it over an asymmetrically encrypted network protocol other than that of the existing command and control channel. The data may also be sent to an alternate network location from the main command and control server.",
    detection: {
      strategyId: "DET0512",
      strategyName: "Detection of Exfiltration Over Asymmetric Encrypted Non-C2 Protocol",
      analytics: [{ id: "AN1413", description: "Detects non-browser processes that establish encrypted outbound connections (e.g., TLS/SSL) to unfamiliar or atypical destinations for the host/user, following a data staging or compression event." }, { id: "AN1414", description: "Detects staged file access (e.g., archive or obfuscation), followed by an encrypted outbound connection (TLS/HTTPS) from unusual processes such as curl/wget, Python scripts, or custom binaries." }, { id: "AN1415", description: "Detects abnormal encrypted network connections (via TLS/HTTPS) initiated by non-browser binaries, particularly after sensitive file access or compression events." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1048.003",
    name: "Exfiltration Over Unencrypted Non-C2 Protocol",
    tactics: ['exfiltration'],
    platforms: ["ESXi", "Linux", "macOS", "Network Devices", "Windows"],
    isSubTechnique: true,
    parentId: "T1048",
    description: "Adversaries may steal data by exfiltrating it over an un-encrypted network protocol other than that of the existing command and control channel. The data may also be sent to an alternate network location from the main command and control server.(Citation: copy_cmd_cisco)",
    detection: {
      strategyId: "DET0149",
      strategyName: "Detection of Exfiltration Over Unencrypted Non-C2 Protocol",
      analytics: [{ id: "AN0423", description: "Detects data access or staging events followed by outbound data flows using unencrypted protocols (e.g., FTP, HTTP) initiated by unexpected processes or to rare destinations." }, { id: "AN0424", description: "Detects file access or compression utilities followed by outbound connections using curl, wget, ftp, or custom binaries communicating over unencrypted protocols." }, { id: "AN0425", description: "Detects abnormal outbound HTTP/FTP connections by local scripts or binaries outside of standard browser activity, following access to local documents or user data." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1537",
    name: "Transfer Data to Cloud Account",
    tactics: ['exfiltration'],
    platforms: ["IaaS", "Office Suite", "SaaS"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may exfiltrate data by transferring the data, including through sharing/syncing and creating backups of cloud environments, to another cloud account they control on the same service.",
    detection: {
      strategyId: "DET0573",
      strategyName: "Cross-Platform Detection of Data Transfer to Cloud Account",
      analytics: [{ id: "AN1580", description: "Detects snapshot sharing, backup exports, or data object transfers from victim-owned cloud accounts to other cloud identities within the same provider (e.g., AWS, Azure) using snapshot sharing, S3 bucket policy updates, or SAS URI generation." }, { id: "AN1581", description: "Detects user activity that shares or syncs files with external domains via link generation, OneDrive external sharing, or file transfer actions involving non-whitelisted partner tenants." }, { id: "AN1582", description: "Detects use of built-in SaaS sharing mechanisms to transfer ownership or share access of critical data to external tenants or untrusted users through API calls or link generation features." }],
      moreAnalytics: 0,
    },
  },
  {
    id: "T1567",
    name: "Exfiltration Over Web Service",
    tactics: ['exfiltration'],
    platforms: ["ESXi", "Linux", "macOS", "Office Suite", "SaaS", "Windows"],
    isSubTechnique: false,
    parentId: null,
    description: "Adversaries may use an existing, legitimate external Web service to exfiltrate data rather than their primary command and control channel. Popular Web services acting as an exfiltration mechanism may give a significant amount of cover due to the likelihood that hosts within a network are already communicating with them prior to compromise. Firewall rules may also already exist to permit traffic to these services.",
    detection: {
      strategyId: "DET0548",
      strategyName: "Detection Strategy for Exfiltration Over Web Service",
      analytics: [{ id: "AN1511", description: "Processes that normally do not initiate network communications suddenly making outbound HTTPS connections with high outbound-to-inbound data ratios. Defender view: correlation between process creation logs (e.g., Word, Excel, PowerShell) and subsequent anomalous network traffic volumes toward common web services (Dropbox, Google Drive, OneDrive)." }, { id: "AN1512", description: "Processes (tar, curl, python scripts) accessing large file sets and initiating outbound HTTPS POST requests with payload sizes inconsistent with baseline activity. Defender perspective: detect abnormal sequence of file archival followed by encrypted uploads to external web services." }, { id: "AN1513", description: "Office apps or scripts writing files followed by xattr manipulation (to evade quarantine) and subsequent HTTPS uploads. Defender perspective: anomalous file modification + outbound TLS traffic originating from non-networking apps (Word, Excel, Preview)." }],
      moreAnalytics: 2,
    },
  },
  {
    id: "T1567.001",
    name: "Exfiltration to Code Repository",
    tactics: ['exfiltration'],
    platforms: ["ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: true,
    parentId: "T1567",
    description: "Adversaries may exfiltrate data to a code repository rather than over their primary command and control channel. Code repositories are often accessible via an API (ex: https://api.github.com). Access to these APIs are often over HTTPS, which gives the adversary an additional level of protection.",
    detection: {
      strategyId: "DET0318",
      strategyName: "Detection Strategy for Exfiltration to Code Repository",
      analytics: [{ id: "AN0895", description: "Processes such as PowerShell, Git, or curl initiating outbound HTTPS POST requests to known code repository APIs (e.g., github.com, gitlab.com) immediately following large file reads. Defender view: correlation between file access of sensitive directories (e.g., Documents, Finance) and abnormal data uploads to repository domains." }, { id: "AN0896", description: "Processes like git, curl, or python scripts executing commands that package files (tar, gzip) followed by HTTPS uploads to code repository endpoints. Defender view: detect unusual git push activity or scripted HTTPS requests outside normal developer work hours." }, { id: "AN0897", description: "Office or scripting applications initiating unusual HTTPS traffic to code repository APIs with high outbound-to-inbound ratios. Defender perspective: monitor for sensitive file access in combination with network connections to github.com, gitlab.com, or bitbucket.org." }],
      moreAnalytics: 1,
    },
  },
  {
    id: "T1567.002",
    name: "Exfiltration to Cloud Storage",
    tactics: ['exfiltration'],
    platforms: ["ESXi", "Linux", "macOS", "Windows"],
    isSubTechnique: true,
    parentId: "T1567",
    description: "Adversaries may exfiltrate data to a cloud storage service rather than over their primary command and control channel. Cloud storage services allow for the storage, edit, and retrieval of data from a remote cloud storage server over the Internet.",
    detection: {
      strategyId: "DET0570",
      strategyName: "Detection Strategy for Exfiltration to Cloud Storage",
      analytics: [{ id: "AN1571", description: "Unusual processes (e.g., powershell.exe, excel.exe) accessing large local files and subsequently initiating HTTPS POST requests to domains associated with cloud storage services (e.g., dropbox.com, drive.google.com, box.com). Defender perspective: correlation between file reads in sensitive directories and high outbound traffic volume to known storage APIs." }, { id: "AN1572", description: "Processes such as curl, wget, rclone, or custom scripts executing uploads to cloud storage endpoints. Defender perspective: detect chained events where tar/gzip is executed to compress files followed by HTTPS PUT/POST requests to known storage services." }, { id: "AN1573", description: "Applications or scripts invoking cloud storage APIs (Dropbox sync, iCloud, Google Drive client) in unexpected contexts. Defender perspective: detect sensitive file reads by non-standard applications followed by unusual encrypted uploads to external cloud storage domains." }],
      moreAnalytics: 1,
    },
  },
];

/** Id-keyed lookup over the vendored subset. Unresolvable ids are a caller bug — check membership first. */
export const ATTACK_BY_ID: Readonly<Record<string, AttackTechnique>> = Object.fromEntries(
  ATTACK_TECHNIQUES.map(technique => [technique.id, technique]),
);

/** Doctrine-keyed index over the vendored subset (tactics arrays flattened). */
export const ATTACK_BY_TACTIC: Readonly<Record<AttackTacticKey, readonly string[]>> = {
  "reconnaissance": ['T1595', 'T1595.001', 'T1595.002', 'T1595.003', 'T1589', 'T1590', 'T1591', 'T1592', 'T1596', 'T1596.001', 'T1596.002', 'T1597'],
  "discovery": ['T1018', 'T1046', 'T1049', 'T1057', 'T1082', 'T1083', 'T1087', 'T1135', 'T1497'],
  "stealth": ['T1027', 'T1036', 'T1070', 'T1070.004', 'T1070.006', 'T1497'],
  "collection": ['T1005', 'T1039', 'T1074', 'T1074.001', 'T1560', 'T1560.001'],
  "command-and-control": ['T1008', 'T1071', 'T1071.001', 'T1071.004', 'T1090', 'T1090.001', 'T1090.002', 'T1090.003', 'T1090.004', 'T1095', 'T1105', 'T1132', 'T1571', 'T1572', 'T1573', 'T1573.001', 'T1573.002'],
  "exfiltration": ['T1020', 'T1029', 'T1030', 'T1041', 'T1048', 'T1048.001', 'T1048.002', 'T1048.003', 'T1537', 'T1567', 'T1567.001', 'T1567.002'],
};

/** Label for an ATT&CK id, falling back to the raw id for unknown input so callers never print `undefined`. */
export function attackLabel(id: string): string {
  return ATTACK_BY_ID[id]?.name ?? id;
}
