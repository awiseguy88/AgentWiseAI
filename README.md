# AgentWiseAI

**AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit [https://aaronwiseai.com/](https://aaronwiseai.com/).**

This repository collects focused open-source tools that help AI engineers and agent builders get real work done, whether they run locally or online.

## Tools built by the GitHub Agent

| Tool | Folder | What it does | Status |
| --- | --- | --- | --- |
| MCP Lemonade Server | [`mcp-lemonade-server/`](mcp-lemonade-server/) | MCP server for local Lemonade image generation and social-post preparation. | Existing |
| MCP Fault Injector | [`mcp-fault-injector/`](mcp-fault-injector/) | Local CLI proxy that injects configurable MCP faults (latency, timeouts, invalid JSON, missing fields, truncation) and reports which faults cause silent wrong answers vs clean failures. | Open [PR #46](https://github.com/awiseguy88/AgentWiseAI/pull/46) |
| DSH Reddit Suite | [`dsh-reddit-suite/`](dsh-reddit-suite/) | Reddit workflow tooling for the DSH agent. | Existing |
| Tool Launcher | [`tool-launcher/`](tool-launcher/) | Lists built tools in the workspace, reads their READMEs, and launches them. | Merged in [PR #6](https://github.com/awiseguy88/AgentWiseAI/pull/6) |
| Agent Reliability Logbook | [`agent-reliability-logbook/`](agent-reliability-logbook/) | Tracks agent claims versus verified outcomes and reliability over time. | Merged in [PR #8](https://github.com/awiseguy88/AgentWiseAI/pull/8) |
| Vibe-Coded App Doctor | [`vibe-coded-app-doctor/`](vibe-coded-app-doctor/) | Scans AI-generated apps for common security, configuration, and reliability mistakes. | Merged in [PR #15](https://github.com/awiseguy88/AgentWiseAI/pull/15) |
| AI Feature Usage Auditor | [`ai-feature-usage-auditor/`](ai-feature-usage-auditor/) | Audits where AI features are used and what they cost. | Merged in [PR #16](https://github.com/awiseguy88/AgentWiseAI/pull/16) |
| Agent Done Claim Verifier | [`agent-done-claim-verifier/`](agent-done-claim-verifier/) | Parses local agent transcripts to verify completion claims against command results and emit HTML/JSON reports with hook-policy snippets. | Open [PR #28](https://github.com/awiseguy88/AgentWiseAI/pull/28) |
| Agent Drift & Step-Level Monitor | [`agent-drift-monitor/`](agent-drift-monitor/) | Monitors agents for drift and step-level failures. | Merged in [PR #17](https://github.com/awiseguy88/AgentWiseAI/pull/17) |
| Glide Classic Escape Kit | [`glide-classic-escape-kit/`](glide-classic-escape-kit/) | Inventories Glide Classic CSV exports and app notes into an offline rebuild report, checklists, and a rough cost worksheet. | Merged in [PR #26](https://github.com/awiseguy88/AgentWiseAI/pull/26) |
| Solo Site Rescue Kit | [`solo-site-rescue-kit/`](solo-site-rescue-kit/) | Helps solo operators diagnose and rebuild fragile sites. | Merged in [PR #18](https://github.com/awiseguy88/AgentWiseAI/pull/18) |
| Model API Watch | [`model-api-watch/`](model-api-watch/) | Scans projects for hard-coded model IDs and reports affected models with change dates, replacements, and cost impact. | Merged in [PR #27](https://github.com/awiseguy88/AgentWiseAI/pull/27) |
| PR Review Cost Guard | [`pr-review-cost-guard/`](pr-review-cost-guard/) | Wraps agent runs with a cheap first-pass scan, monthly spend caps, and HTML/JSON cost reports. | Open [PR #29](https://github.com/awiseguy88/AgentWiseAI/pull/29) |
| Local Model Coding Fit Checker | [`local-model-fit-checker/`](local-model-fit-checker/) | Runs a small coding task suite against local and cloud models and emits a local-vs-API routing report with pass/fail, token cost, and estimated electricity cost. | Open [PR #44](https://github.com/awiseguy88/AgentWiseAI/pull/44) |
| Agent Capability Auditor | [`agent-cap-audit/`](agent-cap-audit/) | Scans agent configs/wrappers (Codex, Claude/Cursor MCP configs, mcp.json, scripts), classifies connector/tool risk, checks per-role policy, and emits HTML/JSON reports with fix snippets. | Open [PR #38](https://github.com/awiseguy88/AgentWiseAI/pull/38) |
| AI Code Disclosure Manifest | [`ai-code-disclosure-manifest/`](ai-code-disclosure-manifest/) | Scans Git repos for AI-assist markers and generates offline HTML/JSON disclosure manifests with notice templates. | Merged in [PR #30](https://github.com/awiseguy88/AgentWiseAI/pull/30) |
| Voice Agent Regression Tester | [`voice-agent-regression-tester/`](voice-agent-regression-tester/) | Offline-first CLI that replays frozen voice-agent call scenarios against a text/HTTP endpoint, scores assertions, and emits HTML/JSON reports with CI-gating exit codes. | Merged in [PR #45](https://github.com/awiseguy88/AgentWiseAI/pull/45) |
| AgentWise Studio | [`agentwise-studio/`](agentwise-studio/) | Local-first app to import agent transcripts, separate verified vs unverified completion claims, inspect slow/repeated steps, persist runs in SQLite, and compare runs. | Merged in [PR #47](https://github.com/awiseguy88/AgentWiseAI/pull/47) |
| DEEPFIELD | [`deepfield/`](deepfield/) | Cinematic 3D Milky Way explorer and planetary simulator with Earth-orbit start, flight modes, HUD, and persistence. | Merged in [PR #50](https://github.com/awiseguy88/AgentWiseAI/pull/50) |

New tools are added by the GitHub Agent in their own subfolders. The agent keeps this index updated as part of every build.

## About AaronWiseAI

Built by [AaronWiseAI](https://aaronwiseai.com/).

AaronWiseAI builds practical, open-source tools for AI agents and developers, online and offline. Visit https://aaronwiseai.com/

Part of the AaronWiseAI open-source tool collection — https://aaronwiseai.com/