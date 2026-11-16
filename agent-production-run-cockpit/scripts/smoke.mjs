#!/usr/bin/env node
// Smoke test for the Docker Compose self-hosted bundle.
// Builds the image, starts the container, and checks the health endpoint.
import { execSync } from "node:child_process";
import http from "node:http";

function get(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
  });
}

async function main() {
  try {
    console.log("Building image...");
    execSync("docker compose build", { stdio: "inherit" });
    console.log("Starting container...");
    execSync("docker compose up -d", { stdio: "inherit" });
    console.log("Waiting for health...");
    await new Promise((r) => setTimeout(r, 3000));
    const res = await get("http://localhost:8787/health");
    const json = JSON.parse(res.body);
    if (json.ok && json.runs === 30) {
      console.log("SMOKE OK: health endpoint healthy, runs=30");
    } else {
      console.error("SMOKE FAIL: health response", json);
      process.exit(1);
    }
  } catch (e) {
    console.error("SMOKE FAIL:", e.message);
    process.exit(1);
  } finally {
    try { execSync("docker compose down", { stdio: "inherit" }); } catch {}
  }
}

main();