# Greptile Round 1 Disposition — ship/v1.4-hardening-validation

Fix commit: `cd43206` (`address greptile review feedback`).
All five findings addressed in one round; every fix carries a pin that fails without it.

## Finding 1 (P1) — PUT action element field types unvalidated

**Site:** `src/server.ts` PUT `/api/teams/white/roe` (~6593).
`target: 123` passed the object-ness check, persisted in the single slot, then
`roeAudit`'s `action.target?.trim()` threw on every GET → 500 forever.
**Fix:** shared `isRoeActionElementValid()` — objects whose audited `command`/`target`
fields (the exact fields `roeAudit` in `src/teams/white.ts` touches) are strings
when present. PUT applies it → 400; the GET restore ladder applies the same
validator → cannot-derive.
**Pin:** `src/__tests__/roe-store-pins.test.ts` → "roe store field validation
(finding 1 pins)": validator definition, PUT-block usage + 400, GET-ladder usage.

## Finding 2 (P1) — redaction drift flips verdicts after restart

**Site:** `src/server.ts` integrity stamps (~6651). Stamps covered `record.text`
only; `persistState`'s `redactSecrets` also rewrites `record.actions`
(`?token=` URLs match the token redaction rule) → violation→compliant flip
after restart with unchanged revision/textHash.
**Fix:** `actionsHash` stamped at PUT (same sha256-hex-slice-16 mechanism over
stable `JSON.stringify` of actions, matching the existing textHash idiom);
GET recomputes over restored actions and folds the comparison into the existing
integrity gate → mismatch = cannot-derive, no verdicts (same emission path,
still 4 redaction-wrapped GET emissions).
**Pin:** `roe-store-pins.test.ts` → "finding 2 pins": PUT stamp + GET recompute
source pins, plus the reviewer's exact scenario as behavior — an action with
`?token=s3cr3t-sync-token-9` round-tripped through the real `redactSecrets`
save/restore path emerges as `token=[redacted]` with a broken stamp, i.e.
cannot-derive rather than a flipped verdict.

## Finding 3 (P1) — BOOLEAN_TOKENS inherited lookup

**Site:** `src/teams/white/roe-parser.ts`. `allow active: constructor` hit
`Object`'s constructor via prototype lookup → `ok:true` with a FUNCTION
directive → `roeAudit` labeled approved nmap compliant.
**Fix:** own-property lookup (`Object.prototype.hasOwnProperty.call`) so
unknown/non-boolean tokens resolve `undefined` → unresolved → `ok:false`,
fail-closed.
**Pin:** `src/__tests__/white-suite.test.ts` → "fails closed on inherited
property names": `constructor`/`toString`/`__proto__`/`hasOwnProperty` each
parse `ok:false`, leave `allowActive` undefined, and land unresolved — and the
GET path withholds verdicts behind `ok:false` (pinned in
`white-routes-static.test.ts`).

## Finding 4 (P1) — RISK_TIER_BY_SEVERITY inherited lookup

**Site:** `src/teams/purple.ts` (~128). Severity `constructor`/`toString`/
`__proto__` resolved to inherited members → undefined tier → renderer call
threw → synthesis 500 (the old prose path responded).
**Fix:** own-property severity lookup with the documented medium fallback.
**Pin:** `src/__tests__/teams-modules.test.ts` → "falls back to medium for
inherited Object property severities": `constructor`/`toString`/`__proto__`
rows asserting medium tier + exact medium prose (agreement, no throw).

## Finding 5 (INFO) — doctor config watch gap

**Site:** `scripts/doctor.mjs` (~144-149). Anchors missed error-rule downgrades
(`prefer-const` error→off passed) and base configs.
**Fix:** anchor set extended to every security-relevant line of
`eslint.config.js`: both base configs (`js.configs.recommended`,
`...tseslint.configs.recommended`), all three error rules (`prefer-const`,
`no-var`, `eqeqeq`), plus the existing warn rules and ignores. Check stays
block-severity; any downgrade breaks byte-match → blocker.
**Pin:** self-evident by structure — `npm run doctor` asserts exact-string
anchors ("all rule + ignores anchors intact").

## Proof (real output)

- Targeted: `Test Files 6 passed (6) / Tests 90 passed (90)`
- Full: `Test Files 102 passed (102) / Tests 1133 passed (1133)`
- Lint: `0 errors, 176 warnings` (touched files warning-free)
- Typecheck: `tsc --noEmit` exit 0
- Doctor: `T3MP3ST doctor: PASS / 30/35 checks passed, 5 warning(s), 0 blocker(s)`
- `npm run test:pr` exit 0
