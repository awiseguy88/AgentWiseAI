// @ts-check
/**
 * Per-minute cost estimation.
 * GitHub-hosted runner pricing varies by OS/size; default is a conservative blended Linux rate.
 */
export function estimateCostMinutes(durationMinutes, ratePerMinute = 0.008) {
  return Math.round((durationMinutes || 0) * ratePerMinute * 100) / 100;
}

export function summarizeCosts(runs, ratePerMinute = 0.008) {
  const byWorkflow = new Map();
  const byRepo = new Map();
  for (const r of runs) {
    const mins = r.duration_minutes || 0;
    const cost = estimateCostMinutes(mins, ratePerMinute);
    const wfKey = r.workflow_name || 'Workflow';
    if (!byWorkflow.has(wfKey)) byWorkflow.set(wfKey, { workflow_name: wfKey, minutes: 0, cost: 0, runs: 0 });
    const w = byWorkflow.get(wfKey);
    w.minutes += mins; w.cost += cost; w.runs++;
  }
  for (const w of byWorkflow.values()) { w.minutes = Math.round(w.minutes*100)/100; w.cost = Math.round(w.cost*100)/100; }
  const workflows = Array.from(byWorkflow.values()).sort((a,b)=>b.cost-a.cost);
  const total_minutes = Math.round(workflows.reduce((s,w)=>s+w.minutes,0)*100)/100;
  const total_cost = Math.round(workflows.reduce((s,w)=>s+w.cost,0)*100)/100;
  return { total_minutes, total_cost, rate_per_minute: ratePerMinute, workflows };
}