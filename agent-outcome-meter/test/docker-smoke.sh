#!/bin/sh
set -eu

BASE_URL="${BASE_URL:-http://localhost:3000}"
echo "Waiting for $BASE_URL ..."
for i in $(seq 1 60); do
  if curl -fsS "$BASE_URL/api/health" >/dev/null 2>&1; then
    echo "Service is up"
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then echo "Service did not start"; exit 1; fi
done

echo "== Ingest proxy usage events =="
INGEST=$(curl -fsS -H 'Content-Type: application/json' \
  -d @test/fixtures/proxy-events.json \
  "$BASE_URL/api/usage")
echo "$INGEST" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['ok']==True and d['inserted']==3, d; print('ingested:', d['inserted'], 'total_cost:', d['total_cost'])"

echo "== Process webhooks =="
SECRET="dev-webhook-secret"
sign() { echo -n "$1" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p -c 256 | sed 's/^/sha256=/'; }

P1='{"action":"closed","pull_request":{"number":10,"merged":true},"repository":{"full_name":"owner/fixture-repo"}}'
SIG1=$(sign "$P1")
WH1=$(curl -fsS -H 'Content-Type: application/json' -H "x-github-event: pull_request" -H "x-hub-signature-256: $SIG1" -d "$P1" "$BASE_URL/api/github-webhook")
echo "$WH1" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['ok']==True and d['event']=='pull_request_merged', d; print('PR merged webhook ok')"

P2='{"check_run":{"external_id":"task-fail-1","conclusion":"failure"},"repository":{"full_name":"owner/fixture-repo"}}'
SIG2=$(sign "$P2")
WH2=$(curl -fsS -H 'Content-Type: application/json' -H "x-github-event: check_run" -H "x-hub-signature-256: $SIG2" -d "$P2" "$BASE_URL/api/github-webhook")
echo "$WH2" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['ok']==True and d['event']=='check_run_failed', d; print('check_run failure webhook ok')"

echo "== Acceptance 1: merged PR cost matches proxy log within 1% =="
MERGED=$(curl -fsS "$BASE_URL/api/dashboard/merged-pr-costs")
echo "$MERGED" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert d['count']==1, d
pr=d['pull_requests'][0]
assert pr['repo']=='owner/fixture-repo' and pr['pr_number']==10, pr
expected=18.90
actual=pr['total_cost_usd']
assert abs(actual-expected)/expected < 0.01, f'cost mismatch: {actual} vs {expected}'
# by model
model_cost=pr['by_model']['claude-sonnet-4-20250514']['cost_usd']
assert abs(model_cost-18.90)<0.01, model_cost
# by turn
assert abs(pr['by_turn']['1']['cost_usd']-10.50)<0.01, pr['by_turn']
assert abs(pr['by_turn']['2']['cost_usd']-8.40)<0.01, pr['by_turn']
print('merged PR cost OK:', actual)
"

echo "== Acceptance 2: failed run counted in total spend, excluded from accepted =="
TOTAL=$(curl -fsS "$BASE_URL/api/dashboard/total-spend")
echo "$TOTAL" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assert abs(d['total_spend_usd']-31.40)<0.01, f'total: {d}'
assert abs(d['accepted_spend_usd']-18.90)<0.01, f'accepted: {d}'
assert abs(d['failed_spend_usd']-12.50)<0.01, f'failed: {d}'
assert d['merged_pr_count']==1, d
assert abs(d['cost_per_accepted_outcome_usd']-18.90)<0.01, d
print('total spend OK:', d)
"

echo "All docker smoke checks passed"