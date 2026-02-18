# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Agentic Architecture (v0.11.2)

## Threat Model (High-Level)
- Unstable SPA DOMs, class-name churn, hidden shadow trees, signed CDN URLs.
- Adversarial risk: script injection into rendered HTML, path traversal in ZIP artifacts.
- Privacy constraint: strict local-only inference and no external AI APIs.

## Data Model (Canonical)
- `messages[]`: role/content/order/attachments.
- `artifacts[]`: binary metadata (`name`, `mime`, `bytes`, `sourceUrl`, `strategy`).
- `items[]`: low-level extraction candidates with confidence + selector.
- `diagnostics`: run trace, verifier scores, learning updates.

## Learning Lifecycle
1. Observe candidates from visual + semantic probes.
2. Score with local embeddings + online learner.
3. Plan multiple extraction strategies.
4. Verify coverage/consistency.
5. Persist best recipe + learner state.

## Verifier Metrics
- message count and continuity
- role sanity
- duplication ratio
- attachment coverage
- renderability constraints

## Troubleshooting
- If model assets missing: run `npm run verify:local-assets`.
- If extraction regresses: compare `diagnostics.learning.recipeBefore/After`.
- If assets fail: inspect `diagnostics.assets.*Failures` and host allowlist.
