# v1.3 Validation Supersession Log

Append-only. Rule: any post-Phase-21 v1.4 commit whose diff touches a file named in a
NN-VALIDATION.md Per-Task Verification Map MUST append one row in the SAME commit,
citing the new green command that re-evidences the mutated surface. The NN-VALIDATION.md
files themselves are never edited after validation — they describe the `4c37232`
boundary; this log is how readers know what has moved since.

| Date | v1.4 Phase (req) | Mutated surface (files) | Validation affected | New evidence (command → result) | Commit |
|------|------------------|-------------------------|---------------------|---------------------------------|--------|
| 2026-10-12 | Phase 22 ROE-01 (`feat(22-01)`, this commit) | src/server.ts (roeRecords slot + PUT/GET /api/teams/white/roe), src/__tests__/white-routes-static.test.ts, bench/roe-adjudication/corpus.json + report.json | 19-VALIDATION P19-C1/C2/C3a/C3b | npx vitest run src/__tests__/white-routes-static.test.ts src/__tests__/roe-store-pins.test.ts src/__tests__/roe-adjudication-bench.test.ts src/__tests__/v13-class-probes.test.ts && node scripts/roe-adjudication-bench.mjs → ALL PASS | feat(22-01) (this commit; hash cited in 22-01-SUMMARY.md) |
