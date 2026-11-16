# Model API Watch smoke fixture

A tiny project with intentional hard-coded model IDs used by the smoke check.

Affected models in this fixture:
- `claude-sonnet-4-5` (retires Nov 30)
- `gemini-4-carbon` (doubles Dec 1)
- `gemini-4-argon` (doubles Dec 1)
- `gpt-5` (family shuts down Dec 11)
- `o3-mini` (family shuts down Dec 11)
- `gpt-5.6-sol` (doubles Jan 1)

Unaffected models (should not be flagged):
- `claude-3-5-sonnet-20241022`
- `gemini-2.5-flash`