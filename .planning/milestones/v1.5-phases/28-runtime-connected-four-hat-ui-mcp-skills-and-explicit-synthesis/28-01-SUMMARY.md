# 28-01 Summary

POST `/api/teams/blue/coverage`, `/api/teams/black/workflow`, and `/api/teams/white/stage` call the phase 27 workflows. Existing GET routes are unchanged. Commit `19212a9`. Tests: `src/__tests__/phase28-workflow-routes.test.ts` plus the three route static pins, 31 passed.

UI, MCP, and published-skill surfaces were not edited. Those files already hold the owner's uncommitted rebrand, and staging them would commit that WIP.
