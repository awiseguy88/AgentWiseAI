import express from "express";
import fs from "fs";
import path from "path";
import { TriageDb } from "./db";
import { listAllWithQueueNumbers, batchResolve, needsInfo, resolveItemWithDelivery, snooze, submitItem } from "./inbox";
import { formatErrors, validateSubmitPayload, restrictChannelTarget } from "./validate";
import { resolveRestrictions, type DeliveryRestrictions } from "./restrictions";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function createApp(dbPath?: string, restrictions?: DeliveryRestrictions) {
  const db = new TriageDb({ dbPath });
  const restrictions_ = restrictions || resolveRestrictions();
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const publicDir = path.join(__dirname, "..", "public");
  if (fs.existsSync(publicDir)) app.use(express.static(publicDir));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.get("/api/inbox", (_req, res) => {
    const queue = listAllWithQueueNumbers(db);
    res.json({ items: queue });
  });

  app.get("/api/items/:id", (req, res) => {
    const item = db.getItem(Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ item });
  });

  app.post("/api/items", (req, res) => {
    const parsed = validateSubmitPayload(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        error: "Invalid decision payload",
        diagnostics: parsed.errors,
        message: formatErrors(parsed.errors),
      });
    }
    const restricted = restrictChannelTarget(parsed.value, restrictions_);
    if (!restricted.ok) {
      return res.status(400).json({ error: "Invalid delivery target", message: restricted.error });
    }
    try {
      const { item, deduped } = submitItem(db, { ...parsed.value, channelTarget: restricted.target });
      res.status(201).json({ item, deduped });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to submit item", message: e?.message || String(e) });
    }
  });

  app.post("/api/items/:id/resolve", async (req, res) => {
    const id = Number(req.params.id);
    if (!db.getItem(id)) return res.status(404).json({ error: "Item not found" });
    if (req.body == null || typeof req.body !== "object" || !("response" in req.body)) {
      return res.status(400).json({ error: "Invalid payload", message: "response is required." });
    }
    const result = await resolveItemWithDelivery(db, id, { response: req.body.response, responder: req.body.responder }, { restrictions: restrictions_ });
    res.json(result);
  });

  app.post("/api/items/:id/snooze", (req, res) => {
    const id = Number(req.params.id);
    if (!db.getItem(id)) return res.status(404).json({ error: "Item not found" });
    const item = snooze(db, id, req.body || {});
    res.json({ item });
  });

  app.post("/api/items/:id/needs-info", (req, res) => {
    const id = Number(req.params.id);
    if (!db.getItem(id)) return res.status(404).json({ error: "Item not found" });
    if (!req.body || typeof req.body.question !== "string" || !req.body.question.trim()) {
      return res.status(400).json({ error: "Invalid payload", message: "question is required." });
    }
    const item = needsInfo(db, id, { question: req.body.question });
    res.json({ item });
  });

  app.post("/api/batch/resolve", async (req, res) => {
    const body = req.body as { resolutions?: Array<{ id: number; response: unknown; responder?: string }> };
    if (!body || !Array.isArray(body.resolutions) || body.resolutions.length === 0) {
      return res.status(400).json({ error: "Invalid payload", message: "resolutions array is required." });
    }
    for (const r of body.resolutions) {
      if (!r || typeof r.id !== "number" || !("response" in r)) {
        return res.status(400).json({ error: "Invalid payload", message: "Each resolution must have numeric id and response." });
      }
      if (!db.getItem(r.id)) return res.status(404).json({ error: "Item not found", id: r.id });
    }
    const results = await batchResolve(db, { resolutions: body.resolutions }, { restrictions: restrictions_ });
    res.json({ results });
  });

  app.get("/api/audit", (_req, res) => {
    res.json({ audit: db.listAudit(), items: db.listItems() });
  });

  app.get("/api/export.json", (_req, res) => {
    const payload = { exportedAt: new Date().toISOString(), items: db.listItems(), audit: db.listAudit() };
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=decision-triage-audit.json");
    res.send(JSON.stringify(payload, null, 2));
  });

  app.get("/api/export.html", (_req, res) => {
    const items = db.listItems();
    const audit = db.listAudit();
    const rows = items
      .map(
        (i) => `<tr>
        <td>${i.id}</td><td>${escapeHtml(i.type)}</td><td>${escapeHtml(i.status)}</td>
        <td>${escapeHtml(i.session || "")}</td><td>${escapeHtml(i.summary)}</td>
        <td>${escapeHtml(i.resolvedBy || "")}</td><td>${escapeHtml(i.resolvedAt || "")}</td>
        <td><pre>${escapeHtml(JSON.stringify(i.response, null, 2) || "")}</pre></td>
        <td>${escapeHtml(i.deliveryError || "")}</td>
      </tr>`
      )
      .join("\n");
    const auditRows = audit
      .map(
        (a) => `<tr><td>${a.id}</td><td>${a.itemId}</td><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.actor || "")}</td><td>${escapeHtml(a.createdAt)}</td><td><pre>${escapeHtml(a.detail || "")}</pre></td></tr>`
      )
      .join("\n");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Decision Triage Audit Report</title>
      <style>body{font-family:system-ui,Arial,sans-serif;margin:24px}table{border-collapse:collapse;width:100%;margin-bottom:24px}th,td{border:1px solid #ddd;padding:8px;vertical-align:top;font-size:13px}th{background:#f6f8fa;text-align:left}pre{white-space:pre-wrap;margin:0}</style>
      </head><body>
      <h1>Agent Decision Triage — Audit Report</h1>
      <p>Exported: ${escapeHtml(new Date().toISOString())}</p>
      <h2>Items</h2>
      <table><thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Session</th><th>Summary</th><th>Responder</th><th>Resolved At</th><th>Response</th><th>Delivery Error</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>Audit Log</h2>
      <table><thead><tr><th>ID</th><th>Item</th><th>Action</th><th>Actor</th><th>At</th><th>Detail</th></tr></thead><tbody>${auditRows}</tbody></table>
      </body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=decision-triage-audit.html");
    res.send(html);
  });

  app.get("/", (_req, res) => {
    const idx = path.join(publicDir, "index.html");
    if (fs.existsSync(idx)) return res.sendFile(idx);
    res.status(404).send("UI not built/installed. Use API endpoints under /api.");
  });

  return { app, db };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3457);
  const { app } = createApp(process.env.TRIAGE_DB_PATH);
  app.listen(port, () => {
    console.log(`agent-decision-triage listening on http://localhost:${port}`);
  });
}