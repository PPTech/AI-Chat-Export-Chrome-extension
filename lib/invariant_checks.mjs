// License: AGPL-3.0
// invariant_checks.mjs - Post-export invariant validation + anomaly scoring.
// Runs after export to detect silent failures, missing data, and anomalies.

/**
 * Run all invariant checks against the export result.
 * @param {Object} exportResult - { platform, title, messages, _extraction? }
 * @param {Object} [options] - { debugMode, advancedLinks }
 * @returns {Object} { pass, score, checks[] }
 */
export function runInvariantChecks(exportResult, options = {}) {
  const checks = [];
  let totalScore = 0;
  let maxScore = 0;

  function check(name, pass, weight = 1, detail = '') {
    const entry = { name, pass: !!pass, weight, detail };
    checks.push(entry);
    maxScore += weight;
    if (pass) totalScore += weight;
    return entry;
  }

  const msgs = exportResult?.messages || [];
  const platform = exportResult?.platform || 'Unknown';

  // 1. Non-empty export
  check('messages_exist', msgs.length > 0, 3,
    msgs.length > 0 ? `${msgs.length} messages found` : 'ZERO messages exported');

  // 2. All messages have role
  const missingRole = msgs.filter((m) => !m.role || m.role === '').length;
  check('all_roles_present', missingRole === 0, 2,
    missingRole > 0 ? `${missingRole} messages lack role` : 'All messages have role');

  // 3. Unknown role ratio <= 5%
  const unknownCount = msgs.filter((m) => /unknown/i.test(m.role)).length;
  const unknownRatio = msgs.length > 0 ? unknownCount / msgs.length : 0;
  check('unknown_role_ratio_ok', unknownRatio <= 0.05, 2,
    `${(unknownRatio * 100).toFixed(1)}% unknown roles (${unknownCount}/${msgs.length})`);

  // 4. All messages have non-empty content
  const emptyContent = msgs.filter((m) => !(m.content || '').trim()).length;
  check('all_content_present', emptyContent === 0, 2,
    emptyContent > 0 ? `${emptyContent} messages have empty content` : 'All messages have content');

  // 5. No duplicate consecutive messages (same role+content)
  let dupeCount = 0;
  for (let i = 1; i < msgs.length; i++) {
    if (msgs[i].role === msgs[i - 1].role && msgs[i].content === msgs[i - 1].content) {
      dupeCount++;
    }
  }
  check('no_consecutive_dupes', dupeCount === 0, 1,
    dupeCount > 0 ? `${dupeCount} consecutive duplicate messages` : 'No consecutive duplicates');

  // 6. Conversation alternation (user/assistant turns roughly alternate)
  const roleSequence = msgs.map((m) => /user/i.test(m.role) ? 'U' : (/assistant|claude|gemini|model/i.test(m.role) ? 'A' : '?'));
  let alternationBreaks = 0;
  for (let i = 1; i < roleSequence.length; i++) {
    if (roleSequence[i] !== '?' && roleSequence[i] === roleSequence[i - 1]) {
      alternationBreaks++;
    }
  }
  const alternationRatio = msgs.length > 1 ? alternationBreaks / (msgs.length - 1) : 0;
  check('role_alternation_ok', alternationRatio <= 0.3, 1,
    `${(alternationRatio * 100).toFixed(1)}% alternation breaks`);

  // 7. Platform matches a known platform
  const KNOWN_PLATFORMS = ['ChatGPT', 'ChatGPT Codex', 'Claude', 'Gemini', 'AI Studio', 'Model'];
  check('platform_known', KNOWN_PLATFORMS.some((p) => platform.includes(p)), 1,
    `Platform: ${platform}`);

  // 8. Title is present
  check('title_present', !!(exportResult?.title || '').trim(), 1,
    exportResult?.title ? `Title: "${exportResult.title.slice(0, 60)}"` : 'No title');

  // 9. No leaked secrets in content (spot check first 5 messages)
  const SECRET_PATTERNS = [
    /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
    /sk-[A-Za-z0-9]{20,}/,
    /api[_-]?key[=:]\s*["']?[A-Za-z0-9._~+/=-]{16,}/i,
  ];
  let leakFound = false;
  for (const m of msgs.slice(0, 5)) {
    for (const pat of SECRET_PATTERNS) {
      if (pat.test(m.content || '')) {
        leakFound = true;
        break;
      }
    }
    if (leakFound) break;
  }
  check('no_leaked_secrets', !leakFound, 2,
    leakFound ? 'Potential secret detected in message content' : 'No secrets detected in sample');

  // 10. Image tokens are well-formed (if present)
  const imgTokenRegex = /\[\[IMG:([^\]]*)\]\]/g;
  let malformedImgs = 0;
  for (const m of msgs) {
    let match;
    while ((match = imgTokenRegex.exec(m.content || '')) !== null) {
      const src = match[1] || '';
      if (!src.startsWith('data:') && !src.startsWith('http') && !src.startsWith('blob:')) {
        malformedImgs++;
      }
    }
  }
  check('image_tokens_valid', malformedImgs === 0, 1,
    malformedImgs > 0 ? `${malformedImgs} malformed image tokens` : 'All image tokens valid');

  // Compute anomaly score (0 = perfect, higher = more issues)
  const normalizedScore = maxScore > 0 ? totalScore / maxScore : 0;
  const anomalyScore = Number((1 - normalizedScore).toFixed(3));

  return {
    pass: checks.every((c) => !c.pass ? c.weight < 2 : true), // fail only if weight>=2 check fails
    score: Number(normalizedScore.toFixed(3)),
    anomalyScore,
    totalChecks: checks.length,
    passedChecks: checks.filter((c) => c.pass).length,
    failedChecks: checks.filter((c) => !c.pass).length,
    checks,
  };
}

/**
 * Build a human-readable summary of invariant check results.
 */
export function formatInvariantSummary(result) {
  const lines = [
    `Invariant Checks: ${result.pass ? 'PASS' : 'FAIL'} (${result.passedChecks}/${result.totalChecks})`,
    `Score: ${(result.score * 100).toFixed(1)}% | Anomaly: ${(result.anomalyScore * 100).toFixed(1)}%`,
    '',
  ];
  for (const c of result.checks) {
    const icon = c.pass ? '✓' : '✗';
    lines.push(`  ${icon} [w${c.weight}] ${c.name}: ${c.detail}`);
  }
  return lines.join('\n');
}
