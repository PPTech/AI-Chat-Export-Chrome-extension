# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Platform Engine Architecture (v0.10.0)

## Design Goal
Create a dedicated extraction engine per chat service, then normalize outputs to a shared standard for export layers.

## Standardized Message Contract
```json
{
  "role": "User|Assistant|Claude|Gemini|Model",
  "content": "normalized text + code fences + [[IMG:...]] tokens",
  "meta": {
    "platform": "ChatGPT|Claude|Gemini|AI Studio",
    "sourceSelector": "engine-specific selector id"
  }
}
```

## Engine Pipeline
1. Platform detection by hostname.
2. Run dedicated engine selector strategy.
3. Extract text/code/images from full message nodes.
4. Normalize into shared contract.
5. Deduplicate by `(role, content)`.
6. Pass normalized result to export pipeline.

## Security Model
- Local-only processing.
- No `eval`/dynamic code execution.
- UI/tooltip/script/style stripping in extraction clone.
- Optional raw HTML mode is explicit opt-in.

## BDD Strategy
- One feature file for core cross-platform behavior.
- Additional feature scenarios auto-generated from parser/export signatures.
