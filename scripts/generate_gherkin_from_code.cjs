// License: MIT
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

const fs = require('fs');

const content = fs.readFileSync('content.js', 'utf8');
const script = fs.readFileSync('script.js', 'utf8');

const engines = [...content.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
const exportFormats = [...script.matchAll(/if \(fmt === '([^']+)'\)/g)].map((m) => m[1]);

let feature = 'Feature: Auto-generated platform and export coverage\n';
for (const engine of engines) {
  feature += `\n  Scenario: ${engine} engine extracts normalized messages\n`;
  feature += `    Given the active tab is ${engine}\n`;
  feature += '    When extraction runs\n';
  feature += '    Then standardized messages are produced\n';
}

for (const fmt of exportFormats) {
  feature += `\n  Scenario: ${fmt.toUpperCase()} export is generated\n`;
  feature += `    Given extracted normalized messages exist\n`;
  feature += `    When user exports ${fmt}\n`;
  feature += '    Then output file content is generated without runtime errors\n';
}

fs.writeFileSync('features/auto_generated.feature', feature);
console.log('Generated features/auto_generated.feature');
