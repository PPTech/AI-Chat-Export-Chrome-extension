const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const version = require('./manifest.json').version;
const fileName = `AI_Chat_Exporter_v${version}.zip`;

console.log(`📦 Packaging AI Chat Exporter v${version}...`);

try {
    // Requires 'zip' utility installed on system (Linux/Mac) or PowerShell (Windows)
    if (process.platform === 'win32') {
        execSync(`powershell Compress-Archive -Path * -DestinationPath ${fileName} -Force`);
    } else {
        execSync(`zip -r ${fileName} . -x "*.git*" "build_release.js" "*.zip"`);
    }
    console.log(`✅ Successfully created: ${fileName}`);
    console.log(`🚀 Upload this file to GitHub Releases.`);
} catch (error) {
    console.error("❌ Packing failed:", error.message);
}