# Third-Party Notices

Purple Team's own source (`src/`, `scripts/`) is MIT-licensed — see [`LICENSE`](LICENSE).
The `bench/` benchmark corpora are **third-party fixtures used for local evaluation
only**: they are gitignored and **not distributed** with this package, retain their
original upstream licenses, and are fetched/staged on demand by the benchmark runners.

| Corpus | Used by | Source / License | Bundled here? |
|---|---|---|---|
| **Cybench** challenge corpus | `scripts/cybench-bench.mjs` | github.com/andyzorigin/cybench (per-challenge upstream licenses) | No — gitignored (`bench/cybench/challenges/`, `corpus-stage/`); staged locally |
| **XBOW / XBEN** validation benchmarks | `scripts/xbow-bench.mjs` | github.com/xbow-engineering/validation-benchmarks (MIT) | No — gitignored (`bench/xbow/stage/`); fetched per run |
| Bundled challenge app code (WordPress / PHP / Flask samples) | challenge containers | respective upstream projects | No — part of the staged challenge sources only |

The CTF/RE/crypto tooling installed into the sandbox image
([`bench/cybench/tools/Dockerfile`](bench/cybench/tools/Dockerfile)) — radare2, gdb,
pwntools, pycryptodome, sympy, z3-solver, fpylll, numpy/scipy, UPX, etc. — is installed
from upstream package repositories at image-build time under each package's own license;
none of it is vendored into this repository.

**Bundled third-party data:** `src/teams/blue/d3fend-ontology.ts` vendors the MITRE
D3FEND™ ontology CSV verbatim (fetched 2026-10-10 from
[d3fend.mitre.org/ontologies/d3fend.csv](https://d3fend.mitre.org/ontologies/d3fend.csv),
ontology v1.6.0) so the blue coverage pipeline ships with no runtime downloads.
D3FEND is © The MITRE Corporation, used under the
[D3FEND Terms of Use](https://d3fend.mitre.org/tou) — a non-exclusive, royalty-free
license for research, development, and commercial purposes that requires reproducing
MITRE's copyright designation and license in copies; both are reproduced in the header
of the vendored file.

`src/teams/black/attack-data.ts` vendors a disclosed trimmed subset of the MITRE
ATT&CK® Enterprise knowledge base (STIX 2.1 bundle, Enterprise ATT&CK v19.2, fetched
2026-10-10 from
[mitre-attack/attack-stix-data](https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json))
so the black suite's attack-data engines ship with no runtime downloads. The subset
covers the six tactics black's doctrine maps to (reconnaissance, discovery, stealth,
collection, command-and-control, exfiltration); the technique-id selection rule and
every verbatim/trim boundary are disclosed in the vendored file's header — no
technique ids are invented. ATT&CK is © The MITRE Corporation, used under the
[ATT&CK Terms of Use](https://attack.mitre.org/resources/terms-of-use/) — a
non-exclusive, royalty-free license for research, development and commercial purposes
that requires reproducing MITRE's copyright designation and license in copies; both
are reproduced in the header of the vendored file.

No third-party code is bundled into the published MIT-licensed core (the CVE-Zero fixtures ship
only our own `ground-truth.json` annotations; upstream repo source is stripped at export and
fetched on demand). If you believe an attribution is missing or incorrect, please open an issue.
