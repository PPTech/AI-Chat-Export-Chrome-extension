# License: MIT
# Code generated with support from CODEX and CODEX CLI.
# Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)

# Premium Agent Console Design (Local-Only)

## Objectives
- Let user describe extraction issues in plain language.
- Convert hints into structured `goalHints` for LocalAgentLoop.
- Persist anonymized feedback labels locally for recipe improvement.

## UX Flow
1. User opens console panel in popup.
2. User selects issue type (missing images/files/order/code blocks).
3. System maps issue to planner flags and retries extraction.
4. Diagnostics report shows before/after score deltas.

## Privacy Constraints
- No external LLM calls.
- No raw message text stored by default in feedback memory.
- User can purge all learning and feedback artifacts.
