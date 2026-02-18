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


## Lessons Learned from Deep Review (v0.11.4)
- Packaging placeholders as “model runtime” erodes trust; release gates now explicitly verify local assets and version consistency.
- Agentic claims must be tied to default execution paths, not optional buttons.
- Security controls must be enforced at both code allowlist and manifest permission layers.
- Diagnostics should preserve engineering utility while redacting sensitive values.


## Canonical Export Contract (v0.11.5)
- Exporters should consume `dataset.messages[].attachments[]` as source of truth.
- Legacy token markers are treated as compatibility output, not primary contract.


## File Relationship Map (Tooling + Contributor Model)
- `manifest.json` → runtime wiring root (content scripts, background worker, offscreen bridge, web-accessible resources).
- `content.js` ↔ `visual_engine.js`/`smart_agent.js`/`asset_processor.js` for extraction + asset capture logic.
- `content.js` ↔ `background.js` via runtime actions (`extract_local_agent`, diagnostics routes, media proxy, artifact download).
- `background.js` ↔ `offscreen.js` for local classifier/agent orchestration and persistence routes.
- `offscreen.js` ↔ `agent/*` + `recipes_store.js` for local loop execution and learning memory.
- `script.js` (popup) ↔ `content.js`/`background.js` for user-triggered extraction/export orchestration.
- `artifact_builder.js` + `export_manager.js` + `export_core.js` compose standalone HTML/MHTML and artifact bundles.
- `scripts/sync_version.cjs` + `scripts/verify_release_consistency.cjs` + `scripts/verify_claims.cjs` enforce release/version/process contracts in CI.
- `tests/unit/*` validate module contracts; `tests/integration/*` validate cross-module runtime contracts; `features/*.feature` track BDD behavior expectations.
