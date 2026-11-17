import http from "node:http";
import { URL } from "node:url";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { SqliteDurabilityStore } from "./db.js";
import type { CreateJobInput } from "./types.js";
import { collectFileHashes, captureGitStatus } from "./workspace.js";
import { replan } from "./replan.js";
import { assertCriterion } from "./acceptance.js";

const DEFAULT_DB = ".local/agent-job-durability-resume.sqlite";

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function json(res: http.ServerResponse, code: number, body: any): void {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

export function createServer(opts: { dbPath?: string; repoRoot: string }) {
  const dbPath = path.resolve(opts.repoRoot, opts.dbPath ?? DEFAULT_DB);
  const repoRoot = opts.repoRoot;
  const store = new SqliteDurabilityStore(dbPath);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    const method = req.method || "GET";
    try {
      // POST /jobs
      if (method === "POST" && url.pathname === "/jobs") {
        const body = (await readJson(req)) as CreateJobInput;
        const job = await store.createJob(body);
        return json(res, 201, { job, dbPath });
      }
      // GET /jobs
      if (method === "GET" && url.pathname === "/jobs") {
        const jobs = await store.listJobs();
        return json(res, 200, { jobs });
      }
      // POST /jobs/:id/suspend
      const suspendMatch = url.pathname.match(/^\/jobs\/([^/]+)\/suspend$/);
      if (method === "POST" && suspendMatch) {
        const id = suspendMatch[1];
        const body = await readJson(req);
        await store.updateJobStatus(id, "suspended", {
          interruptedReason: body.reason ?? "interrupted",
        });
        return json(res, 200, { ok: true });
      }
      // POST /jobs/:id/checkpoint
      const cpMatch = url.pathname.match(/^\/jobs\/([^/]+)\/checkpoint$/);
      if (method === "POST" && cpMatch) {
        const id = cpMatch[1];
        const body = await readJson(req);
        const stepId = body.stepId ?? "initial";
        const fileHashes = collectFileHashes(repoRoot);
        const gitStatus = captureGitStatus(repoRoot);
        const cp = await store.createCheckpoint(id, stepId, {
          fileHashes,
          gitStatus,
          testResults: body.testResults ?? null,
          notes: body.notes ?? null,
        });
        return json(res, 201, { checkpoint: cp });
      }
      // POST /jobs/:id/resume
      const resumeMatch = url.pathname.match(/^\/jobs\/([^/]+)\/resume$/);
      if (method === "POST" && resumeMatch) {
        const id = resumeMatch[1];
        const job = await store.getJob(id);
        if (!job) return json(res, 404, { error: "job not found" });
        const checkpoint = await store.getLatestCheckpoint(id);
        if (!checkpoint) return json(res, 400, { error: "no checkpoint found" });
        await store.incrementResumeCount(id);
        await store.updateJobStatus(id, "recovering");
        const steps = await store.getSteps(id);
        const plan = replan({ job, steps, checkpoint, repoRoot });
        // apply stale marking
        for (const s of plan.staleSteps) {
          await store.updateStepStatus(s.id, "stale", {
            staleReason: plan.validation.reason ?? "workspace changed",
          });
        }
        const refreshedJob = await store.getJob(id);
        await store.recordWorkspaceValidation(id, plan.validation);
        await store.updateJobStatus(id, "suspended", { interruptedReason: "resume_planned" });
        return json(res, 200, {
          job: refreshedJob,
          plan: {
            completedSteps: plan.completedSteps.map((s) => s.name),
            staleSteps: plan.staleSteps.map((s) => s.name),
            pendingSteps: plan.pendingSteps.map((s) => s.name),
            replaySkipped: plan.replaySkipped,
            actions: plan.actions,
            validation: plan.validation,
          },
        });
      }
      // POST /jobs/:id/complete (acceptance check)
      const completeMatch = url.pathname.match(/^\/jobs\/([^/]+)\/complete$/);
      if (method === "POST" && completeMatch) {
        const id = completeMatch[1];
        const job = await store.getJob(id);
        if (!job) return json(res, 404, { error: "job not found" });
        const steps = await store.getSteps(id);
        const notDone = steps.filter((s) => s.status !== "completed");
        if (notDone.length > 0) {
          return json(res, 400, {
            ok: false,
            reason: `steps not complete: ${notDone.map((s) => s.name).join(", ")}`,
          });
        }
        const body = await readJson(req);
        const criteria: any[] = body.acceptanceCriteriaChecks ?? [];
        const results = criteria.map((c) => ({ criterion: c, result: assertCriterion(c, repoRoot) }));
        const allOk = results.every((r) => r.result.ok);
        if (!allOk) {
          await store.updateJobStatus(id, "blocked", {
            interruptedReason: "acceptance criteria failed",
          });
          return json(res, 200, { ok: false, status: "blocked", results });
        }
        await store.updateJobStatus(id, "completed");
        return json(res, 200, { ok: true, status: "completed", results });
      }
      // GET /jobs/:id
      const getMatch = url.pathname.match(/^\/jobs\/([^/]+)$/);
      if (method === "GET" && getMatch) {
        const id = getMatch[1];
        const job = await store.getJob(id);
        if (!job) return json(res, 404, { error: "job not found" });
        const steps = await store.getSteps(id);
        const checkpoint = job.checkpointId ? await store.getCheckpoint(job.checkpointId) : null;
        return json(res, 200, { job, steps, checkpoint });
      }

      // PATCH /steps/:id — mark step status/completed effect (used by tests + agents)
      const stepMatch = url.pathname.match(/^\/steps\/([^/]+)$/);
      if (method === "PATCH" && stepMatch) {
        const id = stepMatch[1];
        const body = await readJson(req);
        await store.updateStepStatus(id, body.status ?? "pending", {
          completedAt: body.completedAt ?? null,
          completedAtEffect: body.completedAtEffect ?? null,
          staleReason: body.staleReason ?? null,
        });
        return json(res, 200, { ok: true });
      }

      // POST /jobs/:id/effects — record an external effect with duplicate guard
      const effectsMatch = url.pathname.match(/^\/jobs\/([^/]+)\/effects$/);
      if (method === "POST" && effectsMatch) {
        const id = effectsMatch[1];
        const body = await readJson(req);
        const effect = await store.recordEffect(id, body.stepId, {
          effectType: body.effectType,
          effectKey: body.effectKey,
          status: body.status ?? "pending",
          result: body.result ?? null,
        });
        return json(res, 201, { effect });
      }

      // GET /jobs/:id/effects
      const effectsGetMatch = url.pathname.match(/^\/jobs\/([^/]+)\/effects$/);
      if (method === "GET" && effectsGetMatch) {
        const id = effectsGetMatch[1];
        const effects = await store.listEffects(id);
        return json(res, 200, { effects });
      }

      json(res, 404, { error: "not found" });
    } catch (e: any) {
      json(res, 500, { error: e?.message ?? String(e) });
    }
  });

  return { server, store, dbPath };
}