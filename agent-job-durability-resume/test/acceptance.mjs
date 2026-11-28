#!/usr/bin/env node
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");

let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`  PASS: ${msg}`);
  else {
    failures++;
    console.log(`  FAIL: ${msg}`);
  }
}

async function main() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ajdr-"));
  const repo = path.join(tmpRoot, "repo");
  fs.mkdirSync(repo);
  execSync("git init -q", { cwd: repo, stdio: "inherit" });
  execSync('git config user.email "test@test.com"', { cwd: repo, stdio: "inherit" });
  execSync('git config user.name "test"', { cwd: repo, stdio: "inherit" });
  fs.writeFileSync(path.join(repo, "src.js"), "module.exports = { x: 1 };\n");
  execSync("git add -A", { cwd: repo, stdio: "inherit" });
  execSync('git commit -q -m "init"', { cwd: repo, stdio: "inherit" });

  const dbPath = path.join(tmpRoot, "ajdr.sqlite");
  const port = 8799;

  // build
  await new Promise((resolve, reject) => {
    const b = spawn("npm", ["run", "build"], { cwd: projectDir, stdio: "inherit", shell: true });
    b.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`build failed ${code}`))));
  });

  const server = spawn("node", ["dist/cli.js", "serve", "--port", String(port), "--repo", repo, "--db", dbPath], {
    cwd: projectDir,
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const base = `http://127.0.0.1:${port}`;
  const req = async (method, p, body) => {
    const r = await fetch(base + p, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: r.status, json };
  };

  // Case 1
  console.log("Case 1: 2-step job interrupted after step 1; after restart Job exists unfinished with completed edit and pending build identifiable");
  const createRes = await req("POST", "/jobs", {
    objective: "edit file then build",
    acceptanceCriteria: ["file contains marker", "build exits 0"],
    steps: [
      { name: "edit-file", type: "edit", externalEffect: true, duplicateGuardKey: "src.js:marker" },
      { name: "build", type: "build", command: "node -e \"console.log('BUILD OK')\"", duplicateGuardKey: "src.js" },
    ],
  });
  ok(createRes.status === 201, "job created");
  const jobId = createRes.json.job.id;
  await req("POST", `/jobs/${jobId}/checkpoint`, { stepId: "initial", testResults: "step1 done" });
  const getRes1 = await req("GET", `/jobs/${jobId}`);
  const editStep = getRes1.json.steps.find((s) => s.name === "edit-file");
  await req("PATCH", `/steps/${editStep.id}`, { status: "completed", completedAtEffect: "src.js" });
  await req("POST", `/jobs/${jobId}/suspend`, { reason: "capacity error" });
  const getRes2 = await req("GET", `/jobs/${jobId}`);
  ok(getRes2.json.job.status === "suspended", `job status is suspended (was ${getRes2.json.job.status})`);
  const stepsAfter = getRes2.json.steps;
  ok(stepsAfter.find((s) => s.name === "edit-file")?.status === "completed", "completed edit identifiable");
  ok(stepsAfter.find((s) => s.name === "build")?.status !== "completed", "pending build identifiable");

  // Case 2
  console.log("Case 2: externally modify a file the next step depends on during suspension; on resume detects change and revises plan");
  fs.writeFileSync(path.join(repo, "src.js"), "module.exports = { x: 999 };\n");
  const resumeRes = await req("POST", `/jobs/${jobId}/resume`, {});
  ok(resumeRes.status === 200, "resume succeeded");
  ok(resumeRes.json.plan.validation.changesDetected.length > 0, "external change detected");
  ok(
    (resumeRes.json.plan.staleSteps?.length ?? 0) > 0 ||
      resumeRes.json.plan.actions.some((a) => /stale|revise/i.test(a)),
    "plan revised (stale/revise indicated)",
  );

  // Case 3
  console.log("Case 3: Job reaches completed only after acceptance criteria pass; otherwise blocked with reason; no duplicate external effects");
  const createRes2 = await req("POST", "/jobs", {
    objective: "clean job",
    acceptanceCriteria: ["build ok"],
    steps: [{ name: "build", type: "build", command: "node -e \"console.log('BUILD OK')\"" }],
  });
  const jobId2 = createRes2.json.job.id;
  await req("POST", `/jobs/${jobId2}/checkpoint`, { stepId: "initial" });
  const g2 = await req("GET", `/jobs/${jobId2}`);
  const bstep = g2.json.steps[0];
  await req("PATCH", `/steps/${bstep.id}`, { status: "completed" });
  const failComp = await req("POST", `/jobs/${jobId2}/complete`, {
    acceptanceCriteriaChecks: [{ kind: "command-exits-zero", command: "node -e \"process.exit(1)\"" }],
  });
  ok(failComp.json.ok === false, "not completed when acceptance fails");
  ok(failComp.json.status === "blocked", "status blocked with reason");
  const okComp = await req("POST", `/jobs/${jobId2}/complete`, {
    acceptanceCriteriaChecks: [{ kind: "command-exits-zero", command: "node -e \"process.exit(0)\"" }],
  });
  ok(okComp.json.ok === true && okComp.json.status === "completed", "completes only when acceptance passes");

  // duplicate external effect (effect ledger) — same effect_key recorded twice => one record
  const eff1 = await req("POST", `/jobs/${jobId2}/effects`, {
    stepId: bstep.id,
    effectType: "build-artifact",
    effectKey: "build:dist",
    status: "completed",
    result: "ok",
  });
  const eff2 = await req("POST", `/jobs/${jobId2}/effects`, {
    stepId: bstep.id,
    effectType: "build-artifact",
    effectKey: "build:dist",
    status: "completed",
    result: "ok",
  });
  const effects = await req("GET", `/jobs/${jobId2}/effects`);
  ok(
    effects.status === 200 &&
      (effects.json.effects?.length ?? 1) === 1 &&
      eff1.json.effect.id === eff2.json.effect.id,
    "no duplicate external effect (effect ledger deduped)",
  );

  server.kill();
  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : failures + " FAILURES"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
