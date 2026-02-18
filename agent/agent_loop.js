// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// نویسنده دکتر بابک سرخپور با کمک ابزار چت جی پی تی.
// agent/agent_loop.js - Observe/Plan/Act/Verify/Learn orchestrator v0.12.0

(function () {
  function mapPredictedType(item, predicted) {
    const next = { ...item };
    if (predicted && predicted !== 'MESSAGE_CONTAINER') next.type = predicted;
    return next;
  }

  async function run(payload = {}) {
    const started = Date.now();
    const host = payload.hostname || payload.host || 'unknown';
    const domainFingerprint = payload.domainFingerprint || 'default';
    const candidates = payload.candidatesFeatures || [];
    const goalHints = payload.extractionGoals || { includeMessages: true, includeImages: true, includeFiles: true };
    const domSnapshotRedacted = String(payload.domSnapshot || "").slice(0, 40000);
    const mem = await self.AgentRecipeMemory.load(host, domainFingerprint);
    const priorScore = Number(mem?.verifier?.verifierMetrics?.score || 0);
    const learnerState = mem.learner || await self.AgentOnlineLearner.load(mem.key);

    const features = await self.AgentFeatureExtractor.toVectors(candidates);
    const requireModel = payload?.requireModel !== false;
    if (requireModel && !features?.embeddingMeta?.model?.loaded) {
      return { ok: false, mode: "agent_model_unavailable", error: features?.embeddingMeta?.model?.fallbackReason || "model_not_loaded", trace: { model: features?.embeddingMeta?.model || null, attempts: [], elapsedMs: Date.now() - started } };
    }
    const classes = features.vectors.map((v) => self.AgentOnlineLearner.classify(learnerState, v));
    const MAX_ATTEMPTS = 8;
    const plans = self.AgentPlanSearch.generate(candidates, classes, MAX_ATTEMPTS);

    const attempts = [];
    let best = { score: -1, items: [], plan: null, metrics: null };
    for (const plan of plans) {
      const selected = candidates.filter((c) => !plan.selectors.length || plan.selectors.includes(c.selector));
      const acted = selected.map((s, idx) => mapPredictedType(s, classes[idx]?.label));
      const metrics = self.AgentVerifier.verify(acted);
      attempts.push({ planId: plan.id, attempt: plan.attempt, confidence: plan.confidence || 0, why: plan.why || [], metrics });
      if (metrics.score > best.score) best = { score: metrics.score, items: acted, plan, metrics };
      if (metrics.score > 0.82) break;
    }

    const positives = [];
    const negatives = [];
    best.items.forEach((item, idx) => {
      const vector = features.vectors[idx];
      if (!vector) return;
      if (item.type === 'USER_TURN' || item.type === 'MODEL_TURN' || item.type === 'CODE_BLOCK' || item.type === 'FILE_CARD' || item.type === 'IMAGE_BLOCK') {
        positives.push({ vector, label: item.type });
      } else {
        negatives.push({ vector, label: 'NOISE' });
      }
    });
    const training = self.AgentOnlineLearner.train(learnerState, [...positives, ...negatives].slice(0, 200));
    await self.AgentOnlineLearner.persist(training.state);

    await self.AgentRecipeMemory.persist({
      host,
      domainFingerprint,
      recipe: best.plan,
      verifierMetrics: best.metrics,
      learnerState: training.state,
      failureCase: best.metrics?.status === 'FAIL' ? { attempts, sampledCandidates: candidates.slice(0, 10).map((c) => ({ type: c.type, confidence: c.confidence })) } : null
    });

    return {
      ok: true,
      mode: 'agent_loop',
      bestExtraction: { items: best.items, recipe: best.plan, metrics: best.metrics },
      trace: {
        goalHints,
        domSnapshotChars: domSnapshotRedacted.length,
        priorBestScore: priorScore,
        model: features.embeddingMeta.model,
        embeddingsCount: features.embeddingMeta.embeddingsCount,
        embeddingMs: features.embeddingMeta.embeddingMs,
        attempts,
        bestPlanScore: best.metrics?.score || 0,
        chosenPlanId: best.plan?.id || null,
        elapsedMs: Date.now() - started,
        learned: { updates: training.updates, positives: positives.length, negatives: negatives.length, scoreDelta: Number(((best.metrics?.score || 0) - priorScore).toFixed(4)) }
      },
      persistedUpdates: { domainKey: mem.key, recipeSaved: !!best.plan, learnerSaved: true, maxAttempts: MAX_ATTEMPTS }
    };
  }

  self.LocalAgentLoop = { run };
})();
