// License: MIT
// Contract test for invariant checks + anomaly scoring.

import test from 'node:test';
import assert from 'node:assert/strict';
import { runInvariantChecks, formatInvariantSummary } from '../../lib/invariant_checks.mjs';

test('healthy export passes all invariant checks', () => {
  const result = runInvariantChecks({
    platform: 'ChatGPT',
    title: 'Test Chat',
    messages: [
      { role: 'User', content: 'Hello there' },
      { role: 'Assistant', content: 'Hi! How can I help?' },
      { role: 'User', content: 'Tell me about AI' },
      { role: 'Assistant', content: 'AI is a broad field of computer science...' },
    ],
  });

  assert.equal(result.pass, true);
  assert.equal(result.anomalyScore, 0);
  assert.equal(result.score, 1);
  assert.equal(result.failedChecks, 0);
});

test('empty messages fails critical checks', () => {
  const result = runInvariantChecks({
    platform: 'ChatGPT',
    title: 'Empty',
    messages: [],
  });

  assert.equal(result.pass, false);
  const msgExist = result.checks.find((c) => c.name === 'messages_exist');
  assert.equal(msgExist.pass, false);
  assert.ok(result.anomalyScore > 0);
});

test('high unknown role ratio fails check', () => {
  const messages = [];
  for (let i = 0; i < 10; i++) {
    messages.push({ role: 'Unknown', content: `Message ${i}` });
  }
  const result = runInvariantChecks({ platform: 'ChatGPT', title: 'Test', messages });

  const unknownCheck = result.checks.find((c) => c.name === 'unknown_role_ratio_ok');
  assert.equal(unknownCheck.pass, false);
  assert.equal(result.pass, false); // weight >= 2
});

test('consecutive duplicates detected', () => {
  const result = runInvariantChecks({
    platform: 'Claude',
    title: 'Dupes',
    messages: [
      { role: 'User', content: 'Hello' },
      { role: 'User', content: 'Hello' }, // consecutive dupe
      { role: 'Claude', content: 'Hi there' },
    ],
  });

  const dupeCheck = result.checks.find((c) => c.name === 'no_consecutive_dupes');
  assert.equal(dupeCheck.pass, false);
  assert.ok(dupeCheck.detail.includes('1'));
});

test('leaked secret in content detected', () => {
  const result = runInvariantChecks({
    platform: 'ChatGPT',
    title: 'Leak',
    messages: [
      { role: 'User', content: 'My key is sk-proj1234567890abcdefghijk' },
      { role: 'Assistant', content: 'I see a key' },
    ],
  });

  const leakCheck = result.checks.find((c) => c.name === 'no_leaked_secrets');
  assert.equal(leakCheck.pass, false);
});

test('empty content messages detected', () => {
  const result = runInvariantChecks({
    platform: 'Gemini',
    title: 'Blank',
    messages: [
      { role: 'User', content: '' },
      { role: 'Gemini', content: 'Response' },
    ],
  });

  const contentCheck = result.checks.find((c) => c.name === 'all_content_present');
  assert.equal(contentCheck.pass, false);
});

test('unknown platform still passes (low weight)', () => {
  const result = runInvariantChecks({
    platform: 'NewPlatform',
    title: 'Test',
    messages: [
      { role: 'User', content: 'Hello' },
      { role: 'Assistant', content: 'World' },
    ],
  });

  const platformCheck = result.checks.find((c) => c.name === 'platform_known');
  assert.equal(platformCheck.pass, false);
  // Still passes overall because platform_known weight is 1
  assert.equal(result.pass, true);
});

test('formatInvariantSummary produces readable output', () => {
  const result = runInvariantChecks({
    platform: 'ChatGPT',
    title: 'Test',
    messages: [
      { role: 'User', content: 'Hi' },
      { role: 'Assistant', content: 'Hello' },
    ],
  });

  const summary = formatInvariantSummary(result);
  assert.ok(summary.includes('Invariant Checks'));
  assert.ok(summary.includes('PASS') || summary.includes('FAIL'));
  assert.ok(summary.includes('Score'));
});

test('anomaly score is between 0 and 1', () => {
  // Perfect case
  const good = runInvariantChecks({
    platform: 'ChatGPT', title: 'T',
    messages: [{ role: 'User', content: 'Hi' }, { role: 'Assistant', content: 'Hey' }],
  });
  assert.ok(good.anomalyScore >= 0 && good.anomalyScore <= 1);

  // Bad case
  const bad = runInvariantChecks({ platform: 'X', title: '', messages: [] });
  assert.ok(bad.anomalyScore >= 0 && bad.anomalyScore <= 1);
  assert.ok(bad.anomalyScore > good.anomalyScore);
});
