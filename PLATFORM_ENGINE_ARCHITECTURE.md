# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Platform Engine Architecture (v0.10.8)

## Objective
Build one dedicated extraction engine per chat platform, then normalize all outputs to a secure shared model for export.

## Engine Separation

### 1) ChatGPT / ChatGPT Codex Engine
- Trigger: `chatgpt.com` or `chat.openai.com`.
- Uses explainable DOM analyzer pipeline:
  - `detectConversationRoot()`
  - `collectMessageNodes()`
  - `inferRole()` with evidence
  - `parseMessageContent()`
- Codex route labeling rule:
  - If URL matches `https://chatgpt.com/codex`, platform name is normalized as `ChatGPT Codex`.

### 2) Claude Engine
- Trigger: `claude.ai`.
- Uses adaptive candidate queries with noise filtering.
- Adds local discovery utility:
  - `discover_claude_structure`
  - saves diagnostics to `window.CLAUDE_DOM_DISCOVERY`.

### 3) Gemini Engine
- Trigger: `gemini.google.com`.
- Uses `GeminiExtractor` probe model:
  - deep traversal + shadow root probing,
  - scope scoring,
  - turn scoring,
  - role evidence,
  - block parsing.
- Saves diagnostics to `window.GEMINI_DOM_ANALYSIS`.

### 4) AI Studio Engine
- Trigger: `aistudio.google.com`.
- Uses multi-selector adaptive fallback strategy with role hints from attributes and structure.

## Shared Message Contract
```json
{
  "role": "User|Assistant|Claude|Gemini|Model|Unknown",
  "content": "normalized text + code fences + [[IMG:...]] tokens",
  "meta": {
    "platform": "ChatGPT|ChatGPT Codex|Claude|Gemini|AI Studio",
    "sourceSelector": "engine signature",
    "confidence": 0.0,
    "evidence": ["signal-a", "signal-b"]
  }
}
```

## Normalization and Safety
1. Strip UI-only noise from cloned nodes.
2. Keep code in fenced blocks.
3. Capture image tokens before cleanup.
4. Deduplicate repeated messages.
5. Send normalized data to export layer only.

## Privacy Boundary
- The architecture is local-only.
- No external AI inferencing endpoint is used for extraction.
- No chat message content is transmitted outside the user browser session.


## Extended Normalized Tokens
- Image tokens: `[[IMG:...]]`
- File tokens: `[[FILE:url|name]]`
