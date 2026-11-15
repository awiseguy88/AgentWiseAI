import { useMemo } from 'react'

type RunStatus = 'success' | 'running' | 'queued'

interface AgentRun {
  id: string
  name: string
  status: RunStatus
  progress: number
  branch: string
  duration: string
}

interface ActivityItem {
  id: string
  icon: string
  tone: 'blue' | 'green' | 'purple' | 'amber'
  title: string
  desc: string
  time: string
}

interface Issue {
  id: string
  title: string
  status: 'open' | 'in_progress' | 'review'
  label: string
  assignee: string
  updated: string
}

const stats = [
  { label: 'Active Agents', value: '3', delta: '+1 since yesterday', neutral: false },
  { label: 'Open Issues', value: '12', delta: '4 need triage', neutral: true },
  { label: 'PRs This Week', value: '8', delta: '+25% vs last week', neutral: false },
  { label: 'Success Rate', value: '96%', delta: 'Last 30 runs', neutral: true },
]

const pulseCommits = [18, 24, 12, 30, 22, 40, 28, 8, 16, 34, 26, 42, 36, 20, 14, 38, 44, 32, 18, 26, 48, 35, 22, 30]
const pulseReviews = [10, 14, 8, 18, 16, 22, 20, 6, 12, 18, 14, 24, 20, 12, 10, 22, 26, 18, 10, 16, 28, 20, 14, 18]

const activity: ActivityItem[] = [
  { id: 'a1', icon: 'PR', tone: 'green', title: 'Pull request merged', desc: 'feat/dashboard-shell merged into main by AgentWiseAI', time: '2m ago' },
  { id: 'a2', icon: 'AI', tone: 'purple', title: 'Agent completed task', desc: 'Issue triage agent labeled 5 new issues and proposed owners', time: '14m ago' },
  { id: 'a3', icon: 'IS', tone: 'amber', title: 'Issue needs attention', desc: '#17 "Add GitHub OAuth sync" is blocked on credentials', time: '38m ago' },
  { id: 'a4', icon: 'CI', tone: 'blue', title: 'Workflow succeeded', desc: 'build-and-test passed on commit 1a7a095 (main)', time: '1h ago' },
  { id: 'a5', icon: 'RP', tone: 'blue', title: 'Repository initialized', desc: 'AgentWiseAI scaffold created and pushed to origin/main', time: '3h ago' },
]

const runs: AgentRun[] = [
  { id: 'r1', name: 'Issue Triage & Labeling', status: 'running', progress: 68, branch: 'agents/triage-batch-42', duration: 'Running for 4m 12s' },
  { id: 'r2', name: 'Dependency Audit', status: 'success', progress: 100, branch: 'agents/deps-audit', duration: 'Completed in 2m 03s' },
  { id: 'r3', name: 'Docs Refresh Proposal', status: 'queued', progress: 0, branch: 'agents/docs-refresh', duration: 'Queued · waiting for runner' },
]

const issues: Issue[] = [
  { id: '#21', title: 'Design system tokens for dashboard components', status: 'in_progress', label: 'ui', assignee: 'agent/ui-builder', updated: '12m ago' },
  { id: '#19', title: 'Connect live GitHub API data source', status: 'open', label: 'integration', assignee: 'unassigned', updated: '1h ago' },
  { id: '#17', title: 'Add GitHub OAuth sync for private repos', status: 'open', label: 'auth', assignee: 'unassigned', updated: '38m ago' },
  { id: '#14', title: 'Agent run history persistence', status: 'review', label: 'backend', assignee: 'agent/data', updated: '2h ago' },
  { id: '#11', title: 'Activity feed filters and search', status: 'open', label: 'feature', assignee: 'unassigned', updated: 'yesterday' },
]

function statusLabel(status: Issue['status']) {
  if (status === 'in_progress') return 'In progress'
  if (status === 'review') return 'In review'
  return 'Open'
}

function statusColor(status: Issue['status']) {
  if (status === 'in_progress') return 'var(--amber)'
  if (status === 'review') return 'var(--accent-2)'
  return 'var(--blue)'
}

function App() {
  const maxPulse = useMemo(() => Math.max(...pulseCommits, ...pulseReviews), [])

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo">AW</div>
          <div>
            <h1 className="title">AgentWiseAI</h1>
            <p className="subtitle">GitHub Agent Dashboard · awiseguy88/AgentWiseAI</p>
          </div>
        </div>
        <div className="header-actions">
          <span className="pill"><span className="dot" /> Agents online</span>
          <span className="pill"><span className="dot amber" /> Demo data mode</span>
          <span className="pill">Updated just now</span>
        </div>
      </header>

      <section className="stats" aria-label="Repository stats">
        {stats.map((s) => (
          <div className="card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={`stat-delta ${s.neutral ? 'neutral' : ''}`}>{s.delta}</div>
          </div>
        ))}
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Repository Pulse</h2>
            <span className="panel-meta">Last 24 hours · commits & reviews</span>
          </div>
          <div className="pulse" role="img" aria-label="Hourly activity bars for commits and reviews">
            {pulseCommits.map((v, i) => (
              <div
                key={`c-${i}`}
                className="bar"
                style={{ height: `${Math.max(8, (v / maxPulse) * 100)}%` }}
                title={`Hour ${i}: ${v} commit events`}
              />
            ))}
          </div>
          <div className="pulse" style={{ height: 70, marginTop: 10 }} aria-hidden="true">
            {pulseReviews.map((v, i) => (
              <div
                key={`r-${i}`}
                className="bar alt"
                style={{ height: `${Math.max(8, (v / maxPulse) * 100)}%` }}
              />
            ))}
          </div>
          <div className="pulse-legend">
            <span className="legend-item"><span className="swatch" /> Commits & pushes</span>
            <span className="legend-item"><span className="swatch alt" /> Reviews & comments</span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Agent Runs</h2>
            <span className="panel-meta">Live queue</span>
          </div>
          <div className="runs">
            {runs.map((run) => (
              <div className="run" key={run.id}>
                <div className="run-top">
                  <div className="run-name">{run.name}</div>
                  <span className={`badge ${run.status}`}>{run.status}</span>
                </div>
                <div className="progress" aria-label={`${run.progress}% complete`}>
                  <span style={{ width: `${run.progress}%` }} />
                </div>
                <div className="run-meta">
                  <span>{run.branch}</span>
                  <span>{run.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Recent Activity</h2>
            <span className="panel-meta">Repository event stream</span>
          </div>
          <ul className="list">
            {activity.map((item) => (
              <li className="list-item" key={item.id}>
                <div className={`icon ${item.tone}`}>{item.icon}</div>
                <div>
                  <p className="item-title">{item.title}</p>
                  <p className="item-desc">{item.desc}</p>
                </div>
                <div className="item-time">{item.time}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Issue Tracker</h2>
            <span className="panel-meta">Top items</span>
          </div>
          <table className="issues">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Status</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{issue.id} · {issue.title}</div>
                    <span className="tag">{issue.label}</span>
                  </td>
                  <td>
                    <span className="status">
                      <span className="status-dot" style={{ background: statusColor(issue.status) }} />
                      {statusLabel(issue.status)}
                    </span>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{issue.updated}</div>
                  </td>
                  <td>{issue.assignee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer">
        AgentWiseAI dashboard scaffold · demo data shown. Connect a GitHub data source to power live metrics.
      </footer>
    </div>
  )
}

export default App
