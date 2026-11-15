# AgentWiseAI

A sleek **GitHub Agent Dashboard** for visualizing repository pulse, agent runs, recent activity, and issue tracking. This repository is managed by the WiseAI GitHub Agent and starts with a demo-ready frontend scaffold.

> The current version runs in **demo data mode** with mock repository metrics so you can explore the UI immediately. Connect a GitHub data source next to power live insights.

## Features

- **Repository pulse** — hourly visualization of commit and review activity
- **Agent runs** — live-style queue with status and progress for agent tasks
- **Activity feed** — recent repository and agent events at a glance
- **Issue tracker** — quick view of top issues, status, labels, and owners
- **Stats overview** — active agents, open issues, PR velocity, and success rate

## Tech stack

- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for fast dev/build

## Getting started

### Prerequisites

- Node.js 18+ (tested with Node 24)
- npm, pnpm, or yarn

### Install

```bash
npm install
# or: pnpm install
```

### Run locally

```bash
npm run dev
```

Then open the URL shown in the terminal (usually <http://localhost:5173>).

### Build for production

```bash
npm run build
npm run preview
```

## Project structure

```text
.
├─ index.html
├─ src/
│  ├─ App.tsx        # Dashboard layout and panels
│  ├─ index.css      # Global styles/theme
│  └─ main.tsx       # React entry point
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## Roadmap ideas

- Connect to GitHub REST/GraphQL APIs for live repository data
- Add authentication (OAuth) for private repositories
- Persist agent run history and workflow logs
- Filters/search for issues and activity
- Real-time updates via webhooks or polling

## License

TBD
