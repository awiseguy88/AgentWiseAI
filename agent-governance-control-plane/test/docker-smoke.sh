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

AGENT="fixture-agent-1"

echo "== Acceptance 1: DELETE blocked and appears in decisions/dashboard; SELECT passes and is logged =="
DEL=$(curl -fsS -H 'Content-Type: application/json' \
  -d '{"tool":"DELETE","args":{"query":"DELETE FROM users WHERE id = 1","id":1}}' \
  "$BASE_URL/api/agents/$AGENT/call")
echo "$DEL" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['outcome']=='block', d; print('DELETE blocked')"

DEC=$(curl -fsS "$BASE_URL/api/decisions?agent_id=$AGENT")
echo "$DEC" | python3 -c "import sys,json; d=json.load(sys.stdin); assert any(x['tool']=='DELETE' and x['decision']=='block' for x in d), d; print('DELETE appears in decisions')"

SEL=$(curl -fsS -H 'Content-Type: application/json' \
  -d '{"tool":"SELECT","args":{"query":"SELECT * FROM users"}}' \
  "$BASE_URL/api/agents/$AGENT/call")
echo "$SEL" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['outcome']=='pass' and d['result']['ok'], d; print('SELECT passed')"

AUD=$(curl -fsS "$BASE_URL/api/audit?agent_id=$AGENT")
echo "$AUD" | python3 -c "import sys,json; d=json.load(sys.stdin); assert any(x['tool']=='SELECT' and x['decision']=='pass' for x in d), 'select not logged'; print('SELECT logged')"
echo "Acceptance 1 OK"

echo "== Acceptance 2: Approver rejects pending write; agent receives denial and no side effect applied =="
BEFORE=$(curl -fsS -H 'Content-Type: application/json' \
  -d '{"tool":"SELECT","args":{"query":"SELECT COUNT(*) as c FROM users"}}' \
  "$BASE_URL/api/agents/$AGENT/call")
BCOUNT=$(echo "$BEFORE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['rows'][0]['c'])")
echo "users before: $BCOUNT"

INS=$(curl -fsS -H 'Content-Type: application/json' \
  -d '{"tool":"INSERT","args":{"query":"INSERT INTO users (name, email) VALUES (?, ?)","name":"Charlie","email":"charlie@example.com"}}' \
  "$BASE_URL/api/agents/$AGENT/call")
echo "$INS" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['outcome']=='approval', d; print('INSERT queued for approval', d['approvalId'])"
APR_ID=$(echo "$INS" | python3 -c "import sys,json; print(json.load(sys.stdin)['approvalId'])")

PEND=$(curl -fsS "$BASE_URL/api/approvals?status=pending")
echo "$PEND" | python3 -c "import sys,json; d=json.load(sys.stdin); ids=[x['id'] for x in d]; assert $APR_ID in ids, (ids, $APR_ID); print('pending approval visible')"

REJ=$(curl -fsS -H 'Content-Type: application/json' -d '{"approver":"docker-smoke"}' \
  "$BASE_URL/api/approvals/$APR_ID/reject")
echo "$REJ" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['approval']['status']=='rejected' and d.get('denied')==True, d; print('rejected, agent denied')"

AFTER=$(curl -fsS -H 'Content-Type: application/json' \
  -d '{"tool":"SELECT","args":{"query":"SELECT COUNT(*) as c FROM users"}}' \
  "$BASE_URL/api/agents/$AGENT/call")
ACOUNT=$(echo "$AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['rows'][0]['c'])")
echo "users after: $ACOUNT"
if [ "$BCOUNT" != "$ACOUNT" ]; then echo "FAIL: side effect applied"; exit 1; fi
echo "Acceptance 2 OK"

echo "== Acceptance 3: Audit log retrievable by agent ID/timestamp and tamper-evident =="
AUDIT=$(curl -fsS "$BASE_URL/api/audit?agent_id=$AGENT")
echo "$AUDIT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d)>0 and all(x['agent_id']=='$AGENT' and x.get('created_at') for x in d), 'audit not retrievable'; print('audit retrievable by agent_id and timestamp')"

V1=$(curl -fsS "$BASE_URL/api/audit/verify")
echo "$V1" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['tampered']==False, d; print('audit chain intact')"

# Tamper: alter an entry directly in the DB inside the container volume is not directly accessible from host in this script,
# but we can verify the endpoint reports tamper correctly by calling a debug endpoint? No debug endpoint.
# Instead, verify via a second container exec if docker compose is available, or skip direct tamper in HTTP smoke and rely on unit smoke.
# Try docker compose exec if available:
if command -v docker >/dev/null 2>&1; then
  CID=$(docker compose ps -q app 2>/dev/null || docker-compose ps -q app 2>/dev/null || true)
  if [ -n "$CID" ]; then
    echo "Tampering with audit entry inside container..."
    docker exec "$CID" node -e "
      const {DatabaseSync}=require('node:sqlite');
      const db=new DatabaseSync('/data/app.db');
      const r=db.prepare('SELECT id FROM audit_log ORDER BY id ASC LIMIT 1').get();
      if(r){ db.prepare(\"UPDATE audit_log SET decision='tampered' WHERE id=?\").run(r.id); console.log('tampered', r.id); }
    " || echo "tamper exec failed"
    V2=$(curl -fsS "$BASE_URL/api/audit/verify")
    echo "$V2" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['tampered']==True, d; print('tamper detected')"
  else
    echo "Skipping in-container tamper step (no compose container id found); verified intact chain via HTTP"
  fi
else
  echo "Docker CLI not available in smoke runner; verified intact chain and retrievability via HTTP"
fi
echo "Acceptance 3 OK (HTTP checks)"

echo "All docker smoke checks passed"
