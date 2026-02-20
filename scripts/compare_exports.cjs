#!/usr/bin/env node
// License: AGPL-3.0
// compare_exports.cjs - Cross-platform export quality comparator.
// Loads JSON exports and computes quality metrics.
// Usage: node scripts/compare_exports.cjs [dir-with-json-exports]
//
// If no directory given, checks ./forensics/ for JSON files.
// Writes forensics/compare_report.md with results.
// Exit code: 0 = pass, 1 = threshold breach.

'use strict';

const fs = require('fs');
const path = require('path');

const THRESHOLDS = {
  unknown_role_ratio_max: 0.05, // ChatGPT must be < 5% unknown roles
  html_contamination_max: 0.0,  // ~0% for non-raw exports
};

const HTML_PATTERN = /<(div|span|p|section|article|nav|aside|header|footer)\b[^>]*class=/i;

function analyzeExport(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { file: path.basename(filePath), error: 'Invalid JSON' };
  }

  const messages = data.messages || [];
  const platform = data.platform || 'Unknown';
  const total = messages.length;

  // Role distribution
  const roleCounts = {};
  for (const m of messages) {
    const role = (m.role || 'missing').toLowerCase();
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  }
  const unknownCount = (roleCounts['unknown'] || 0) + (roleCounts['missing'] || 0);
  const unknownRatio = total > 0 ? unknownCount / total : 0;

  // HTML contamination
  let htmlContaminated = 0;
  for (const m of messages) {
    const content = m.content || '';
    if (HTML_PATTERN.test(content)) {
      htmlContaminated++;
    }
  }
  const htmlContaminationRatio = total > 0 ? htmlContaminated / total : 0;

  // Attachment counts
  let attachmentsDetected = 0;
  let attachmentsEmbedded = 0;
  const imgTokenRegex = /\[\[IMG:([^\]]*)\]\]/g;
  const fileTokenRegex = /\[\[FILE:([^\]]*)\]\]/g;
  for (const m of messages) {
    const content = m.content || '';
    let match;
    while ((match = imgTokenRegex.exec(content)) !== null) {
      attachmentsDetected++;
      if (match[1].startsWith('data:')) attachmentsEmbedded++;
    }
    while ((match = fileTokenRegex.exec(content)) !== null) {
      attachmentsDetected++;
    }
  }

  // Charset issues: detect non-ASCII in content (for PDF sanity)
  let nonAsciiMessages = 0;
  for (const m of messages) {
    if (/[^\x00-\x7F]/.test(m.content || '')) {
      nonAsciiMessages++;
    }
  }

  return {
    file: path.basename(filePath),
    platform,
    total,
    roleCounts,
    unknownCount,
    unknownRatio: Number(unknownRatio.toFixed(4)),
    htmlContaminated,
    htmlContaminationRatio: Number(htmlContaminationRatio.toFixed(4)),
    attachmentsDetected,
    attachmentsEmbedded,
    nonAsciiMessages,
  };
}

function generateReport(results) {
  const lines = [
    '# Cross-Platform Export Comparison Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
  ];

  let allPass = true;

  for (const r of results) {
    if (r.error) {
      lines.push(`## ${r.file}`, `**ERROR**: ${r.error}`, '');
      continue;
    }

    const roleStr = Object.entries(r.roleCounts).map(([k, v]) => `${k}=${v}`).join(', ');
    const unknownPass = r.unknownRatio <= THRESHOLDS.unknown_role_ratio_max;
    const htmlPass = r.htmlContaminationRatio <= THRESHOLDS.html_contamination_max;

    if (!unknownPass || !htmlPass) allPass = false;

    lines.push(
      `## ${r.file} (${r.platform})`,
      '',
      '| Metric | Value | Threshold | Status |',
      '|--------|-------|-----------|--------|',
      `| Messages | ${r.total} | - | - |`,
      `| Role distribution | ${roleStr} | - | - |`,
      `| Unknown role ratio | ${(r.unknownRatio * 100).toFixed(1)}% | <${THRESHOLDS.unknown_role_ratio_max * 100}% | ${unknownPass ? 'PASS' : 'FAIL'} |`,
      `| HTML contamination | ${(r.htmlContaminationRatio * 100).toFixed(1)}% (${r.htmlContaminated} msgs) | ~0% | ${htmlPass ? 'PASS' : 'FAIL'} |`,
      `| Attachments detected | ${r.attachmentsDetected} | - | - |`,
      `| Attachments embedded | ${r.attachmentsEmbedded} | - | - |`,
      `| Non-ASCII messages | ${r.nonAsciiMessages} | - | info |`,
      '',
    );
  }

  lines.push(`## Overall: ${allPass ? 'PASS' : 'FAIL'}`, '');
  return { report: lines.join('\n'), pass: allPass };
}

function main() {
  const dir = process.argv[2] || path.join(__dirname, '..', 'forensics');

  if (!fs.existsSync(dir)) {
    console.log(`[compare_exports] No directory found at ${dir}, skipping.`);
    process.exit(0);
  }

  const jsonFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.includes('run_summary') && !f.includes('asset_failures'));

  if (!jsonFiles.length) {
    console.log(`[compare_exports] No JSON export files found in ${dir}, skipping.`);
    process.exit(0);
  }

  const results = jsonFiles.map((f) => analyzeExport(path.join(dir, f)));
  const { report, pass } = generateReport(results);

  const reportPath = path.join(dir, 'compare_report.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`[compare_exports] Report written to ${reportPath}`);

  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.file}: ERROR - ${r.error}`);
    } else {
      const status = (r.unknownRatio <= THRESHOLDS.unknown_role_ratio_max && r.htmlContaminationRatio <= THRESHOLDS.html_contamination_max) ? 'PASS' : 'FAIL';
      console.log(`  ${r.file}: ${status} (unknown=${(r.unknownRatio * 100).toFixed(1)}%, html=${(r.htmlContaminationRatio * 100).toFixed(1)}%)`);
    }
  }

  if (!pass) {
    console.error('[compare_exports] THRESHOLD BREACH detected. See report for details.');
    process.exit(1);
  }

  console.log('[compare_exports] All thresholds passed.');
}

main();
