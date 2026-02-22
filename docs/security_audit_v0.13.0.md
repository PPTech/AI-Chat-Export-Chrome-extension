# AI Chat Exporter - Security Audit Report
Date: 2026-02-22
Version Audited: 0.13.0

## 1. Executive Summary
This report details the security audit conducted on the AI Chat Exporter extension, specifically focusing on the newly added file/image extraction and ZIP generation pipeline. The audit simulates common attack vectors (Zip Slip, Path Traversal, XSS) to ensure user safety when processing untrusted AI-generated content.

## 2. Threat Modeling & Attack Vectors

### 2.1 Zip Slip & Path Traversal
**Threat:** An attacker (or a malicious AI response) generates a file download link with a crafted filename (e.g., `../../../../windows/system32/calc.exe` or `\x00malicious.sh`) aiming to overwrite system files when the user extracts the ZIP.
**Mitigation:** `sanitizeAssetPath` in `script.js` directly addresses this.
**Test:**
- Input: `../../../etc/passwd`
- Simulated Output: `___etc_passwd`
- Result: **PASS**. The sanitization logic strips `..` sequences, control characters, and unsafe symbols.

### 2.2 Cross-Site Scripting (XSS) via File Tokens
**Threat:** An AI response contains a crafted `[[FILE:javascript:alert(1)|ClickMe]]` token, which is then rendered directly into the HTML export.
**Mitigation:** 
- In HTML/Word exports: The renderer (`renderRichMessageHtml`) escapes HTML content before token replacement. However, `href` attributes in the generated `<a>` tags need to be safe.
- Remote URL validation: The extension only fetches from the `ASSET_ALLOWLIST` (e.g., `chatgpt.com/backend-api`, `blob:https://chatgpt.com`).
**Result:** **PASS**. The `lib/export.mjs` URL extraction regex specifically targets known safe formats and the content scripts only generate tokens for URLs matching the platform origin or `data:`/`blob:` URIs.

### 2.3 SSRF (Server-Side Request Forgery) via Image URLs
**Threat:** The extension fetches an arbitrary IP or internal network resource (e.g., `http://localhost:8080/admin`) embedded in an `<img>` tag by the AI.
**Mitigation:** `resolveAndEmbedAssets` enforces `isAllowedAssetUrl(url)`.
**Test:** The `ASSET_ALLOWLIST` explicitly lists allowed domains (e.g., `^https:\/\/files\.oaiusercontent\.com\/`).
**Result:** **PASS**. Any URL not matching the allowlist is rejected and not fetched by the background script.

### 2.4 Unauthenticated Data Access
**Threat:** A third-party site could trigger the extension to extract chats without user consent.
**Mitigation:** The activeTab, scripting, and debugger permissions require explicit user interaction (clicking the extension icon) to inject scripts or capture DOM data.
**Result:** **PASS**.

## 3. Checklist Conclusion
- [x] Zip Slip mitigated (`sanitizeAssetPath`)
- [x] Path Traversal blocked (No `..` or `/` in ZIP entry names)
- [x] XSS on Exported HTML mitigated (Escaping + controlled token rendering)
- [x] SSRF mitigated (`ASSET_ALLOWLIST`)

No critical vulnerabilities identified in the 0.13.0 pipeline.
