#!/bin/sh
set -eu

BASE_URL="${BASE_URL:-http://localhost:3000}"
echo "Waiting for $BASE_URL ..."
for i in $(seq 1 30); do
  if curl -fsS "$BASE_URL/api/health" >/dev/null 2>&1; then
    echo "Service is up"
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then echo "Service did not start"; exit 1; fi
done

COOKIE_JAR=/tmp/valg_cookies.txt
rm -f "$COOKIE_JAR"

login() {
  curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"password\"}" "$BASE_URL/api/login" >/dev/null
  echo "logged in $1"
}

echo "== Acceptance 1: scope expansion blocked until reviewer approves =="
login admin
APP=$(curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d '{"name":"compose-billing","owner_id":1,"reviewer_id":3,"audience":"team-b","data_scope":"read-only reports"}' \
  "$BASE_URL/api/apps")
APP_ID=$(echo "$APP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "app id $APP_ID"

login reviewer-1
INIT_REL=$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/apps/$APP_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); print([r['id'] for r in d['releases'] if r['status']=='pending'][0])")
curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' -d '{}' "$BASE_URL/api/releases/$INIT_REL/approve" >/dev/null
login dev-a
curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' -d '{}' "$BASE_URL/api/apps/$APP_ID/checklist/confirm" >/dev/null
login reviewer-1
curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' -d '{}' "$BASE_URL/api/apps/$APP_ID/checklist/signoff" >/dev/null

login dev-a
SUB=$(curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d '{"version":"2.0.0","data_scope":"write billing records"}' \
  "$BASE_URL/api/apps/$APP_ID/releases")
echo "$SUB" | grep -q '"status":"pending"'
REL_ID=$(echo "$SUB" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

login admin
MID=$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/apps/$APP_ID")
echo "$MID" | grep -q 'read-only reports'

login reviewer-1
APR=$(curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' -d '{}' "$BASE_URL/api/releases/$REL_ID/approve")
echo "$APR" | grep -q '"status":"approved"'

login admin
AUDIT=$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/audit?action=release_approved&targetType=release&targetId=$REL_ID")
echo "$AUDIT" | grep -q 'reviewer-1'
echo "$AUDIT" | grep -q 'write billing records'
echo "Acceptance 1 OK"

echo "== Acceptance 2: governance checklist blocks launch until owner confirms and reviewer signs off =="
APP2=$(curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d '{"name":"compose-teamc","owner_id":2,"reviewer_id":3,"audience":"team-c","data_scope":"read-only"}' \
  "$BASE_URL/api/apps")
APP2_ID=$(echo "$APP2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

login admin
CL=$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/apps/$APP2_ID/checklist")
echo "$CL" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['launchGate']['blocked']==True, d; print('blocked initially')"

login dev-b
curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' -d '{}' "$BASE_URL/api/apps/$APP2_ID/checklist/confirm" >/dev/null
login reviewer-1
curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' -d '{}' "$BASE_URL/api/apps/$APP2_ID/checklist/signoff" >/dev/null
login admin
CL2=$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/apps/$APP2_ID/checklist")
echo "$CL2" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['checklist']['owner_confirmed']==1 and d['checklist']['reviewer_signed_off']==1, d; print('checklist cleared')"
echo "Acceptance 2 OK"

echo "== Acceptance 3: CI webhook flags shadow IT and blocks deployment until registered or retired =="
RPT=$(curl -fsS -H 'Content-Type: application/json' \
  -d '{"app_name":"compose-shadow","changed_files":["tools/compose-shadow/index.js"],"pr":42}' \
  "$BASE_URL/api/ci/report")
echo "$RPT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['shadowIt'] and d['deploymentBlocked'], d; print('shadow IT flagged')"
RPT_ID=$(echo "$RPT" | python3 -c "import sys,json; print(json.load(sys.stdin)['reportId'])")

login admin
DET=$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/audit?action=shadow_it_detected&targetType=shadow_it&targetId=$RPT_ID")
echo "$DET" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d)>=1, d; print('detected')"

REG=$(curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d '{"name":"compose-shadow","owner_id":2,"reviewer_id":3,"audience":"team-c","data_scope":"read-only"}' \
  "$BASE_URL/api/apps")
REG_ID=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
RES=$(curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d "{\"action\":\"register\",\"app_id\":$REG_ID}" \
  "$BASE_URL/api/shadow-it/$RPT_ID/resolve")
echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='resolved', d; print('resolved')"
RESA=$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/audit?action=shadow_it_resolved&targetType=shadow_it&targetId=$RPT_ID")
echo "$RESA" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d)>=1, d; print('resolution audited')"
echo "Acceptance 3 OK"

echo "All docker smoke checks passed"
