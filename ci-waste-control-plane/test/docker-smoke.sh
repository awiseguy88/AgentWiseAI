#!/bin/sh
set -eu

BASE_URL="${BASE_URL:-http://localhost:3000}"
echo "Waiting for $BASE_URL ..."
for i in $(seq 1 40); do
  if curl -fsS "$BASE_URL/api/health" >/dev/null 2>&1; then
    echo "Service is up"
    break
  fi
  sleep 1
  if [ "$i" -eq 40 ]; then echo "Service did not start"; exit 1; fi
done

echo "== Acceptance 1: dashboard lists each waste category with recoverable minutes and shows top wasteful workflow per repo =="
DASH=$(curl -fsS "$BASE_URL/api/dashboard")
echo "$DASH" | python3 -c "import sys,json; d=json.load(sys.stdin); cats=['superseded','push_pr_duplicate','zombie_cron','flaky_job','missing_timeout']; assert all(k in d['categories'] for k in cats), d['categories']; print('categories present')"
echo "$DASH" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['total_recoverable_minutes']>0, d; assert any(r['top_wasteful_workflow'] for r in d['repos']), d; print('top wasteful workflows present')"
echo "Acceptance 1 OK"

echo "== Acceptance 2: clean repo has zero recoverable minutes and no remediation PRs =="
STABLE_ID=$(curl -fsS "$BASE_URL/api/repos" | python3 -c "import sys,json; print(next(r['id'] for r in json.load(sys.stdin) if r['owner']=='acme' and r['name']=='stable-lib'))")
STABLE=$(curl -fsS "$BASE_URL/api/repos/$STABLE_ID")
echo "$STABLE" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['dashboard']['total_recoverable_minutes']==0, d['dashboard']; print('stable-lib zero recoverable')"
REM=$(curl -fsS -X POST -H 'Content-Type: application/json' -d '{"mode":"dry-run"}' "$BASE_URL/api/repos/$STABLE_ID/remediate")
echo "$REM" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['remediations']==[], d; print('no false-positive remediation PRs')"
echo "Acceptance 2 OK"

echo "== Acceptance 3: repo missing concurrency cancellation gets a PR adding the concurrency block and reports estimated minutes saved =="
AGENT_ID=$(curl -fsS "$BASE_URL/api/repos" | python3 -c "import sys,json; print(next(r['id'] for r in json.load(sys.stdin) if r['owner']=='acme' and r['name']=='agent-app'))")
REM3=$(curl -fsS -X POST -H 'Content-Type: application/json' -d '{"mode":"dry-run"}' "$BASE_URL/api/repos/$AGENT_ID/remediate")
echo "$REM3" | python3 -c "import sys,json; d=json.load(sys.stdin); conc=[r for r in d['remediations'] if r['category']=='concurrency']; assert conc, d; assert 'concurrency' in conc[0]['diff'].lower(), conc[0]; assert conc[0]['estimated_minutes_saved']>0, conc[0]; print('concurrency PR created with estimated minutes saved')"
echo "Acceptance 3 OK"

echo "All docker smoke checks passed"