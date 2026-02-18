// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// agent/recipe_memory.js - Domain memory bridge v0.11.5

(function () {
  async function load(host, domainFingerprint) {
    const key = `${host}::${domainFingerprint}`;
    const recipe = await self.RecipeManager.getRecipe(host, domainFingerprint).catch(() => null);
    const learner = await self.RecipeManager.getLearnerState(key).catch(() => null);
    const verifier = await self.RecipeManager.getVerifierMetrics(host, domainFingerprint).catch(() => null);
    return { key, recipe, learner, verifier };
  }

  async function persist(payload = {}) {
    const { host, domainFingerprint, recipe, verifierMetrics, failureCase, learnerState } = payload;
    if (recipe) {
      await self.RecipeManager.saveRecipe({
        host,
        domainFingerprint,
        selectors: recipe.selectors || [],
        quality: verifierMetrics?.status || 'PASS',
        notes: JSON.stringify({ verifierMetrics, updatedBy: 'agent_loop' }).slice(0, 1000)
      });
    }
    if (learnerState) await self.RecipeManager.saveLearnerState(learnerState);
    if (failureCase) await self.RecipeManager.saveFailureCase({ host, domainFingerprint, failureCase });
    if (verifierMetrics) await self.RecipeManager.saveVerifierMetrics({ host, domainFingerprint, verifierMetrics });
    return { ok: true };
  }

  self.AgentRecipeMemory = { load, persist };
})();
