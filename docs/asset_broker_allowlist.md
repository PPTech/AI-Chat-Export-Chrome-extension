# Asset Broker Allowlist

## Approved host groups
- chat.openai.com / chatgpt.com / *.openai.com / *.oaistatic.com
- claude.ai / *.anthropic.com
- gemini.google.com / aistudio.google.com / *.googleusercontent.com / *.gstatic.com

## Rationale
- These hosts are first-party chat application origins and their file CDNs used for attachment delivery.
- Broker requests are constrained to GET + `credentials: include` from active tab context with user gesture proof.
- Any non-allowlisted host is blocked and returned as explicit export error stubs.
