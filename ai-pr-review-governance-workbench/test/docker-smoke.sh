#!/bin/sh
set -eu

BASE_URL="${BASE_URL:-http://localhost:3000}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-compose-webhook-secret}"
echo "Waiting for $BASE_URL ..."
for i in $(seq 1 30); do
  if curl -fsS "$BASE_URL/api/health" >/dev/null 2>&1; then
    echo "Service is up"
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then echo "Service did not start"; exit 1; fi
done

echo "== Acceptance 1: oversized PR flagged as sprawl =="
python3 - "$BASE_URL" "$WEBHOOK_SECRET" <<'PY'
import json, hmac, hashlib, urllib.request, sys
base = sys.argv[1]; secret = sys.argv[2]
# build oversized payload ~2400 lines / ~38 files
diff = []
for i in range(38):
    diff.append({"path": f"src/module{i+1}/file{i+1}.ts", "additions": 50 + (i*7)%110, "deletions": 20 + (i*3)%40})
lines = sum(f["additions"]+f["deletions"] for f in diff)
assert lines > 500
payload = {"action":"opened","number":241,"title":"feat: add AI agent scaffolding","user":{"login":"ai-coder-bot"},"html_url":"https://github.com/awiseguy88/AgentWiseAI/pull/241","additions":sum(f["additions"] for f in diff),"deletions":sum(f["deletions"] for f in diff),"changed_files":len(diff),"repository":{"full_name":"awiseguy88/AgentWiseAI"},"diff":diff}
body = json.dumps(payload).encode()
sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
req = urllib.request.Request(base+"/api/webhooks/github", data=body, headers={"Content-Type":"application/json","x-github-event":"pull_request","x-hub-signature-256":sig})
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
assert data["sprawl"] is True, data
print("sprawl flagged, lines", data["lines"], "files", data["files"])
PY

echo "== Acceptance 2: within-limits PR not flagged =="
python3 - "$BASE_URL" "$WEBHOOK_SECRET" <<'PY'
import json, hmac, hashlib, urllib.request, sys
base = sys.argv[1]; secret = sys.argv[2]
diff = [{"path":"src/a.ts","additions":40,"deletions":10},{"path":"src/b.ts","additions":20,"deletions":5}]
payload = {"action":"opened","number":7,"title":"fix: docs","user":{"login":"dev-a"},"html_url":"https://github.com/awiseguy88/AgentWiseAI/pull/7","additions":60,"deletions":15,"changed_files":2,"repository":{"full_name":"awiseguy88/AgentWiseAI"},"diff":diff}
body = json.dumps(payload).encode()
sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
req = urllib.request.Request(base+"/api/webhooks/github", data=body, headers={"Content-Type":"application/json","x-github-event":"pull_request","x-hub-signature-256":sig})
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
assert data["sprawl"] is False, data
print("not flagged")
PY

echo "== Acceptance 3: invalid signature -> 401 =="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H 'Content-Type: application/json' -H 'x-github-event: pull_request' -H 'x-hub-signature-256: sha256=deadbeef' -d '{"action":"opened","pull_request":{"number":999}}' "$BASE_URL/api/webhooks/github")
test "$HTTP_CODE" = "401" || { echo "expected 401 got $HTTP_CODE"; exit 1; }
echo "401 OK"

echo "All docker smoke checks passed"