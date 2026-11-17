import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import type { FileHashEntry } from "./types.js";

export function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function listTrackedFiles(repoRoot: string): string[] {
  try {
    const out = execSync("git ls-files -z", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20000,
    });
    return out
      .split("\0")
      .filter(Boolean)
      .sort();
  } catch {
    // fallback: walk a shallow set (avoid node_modules/.git)
    const results: string[] = [];
    const ignore = new Set(["node_modules", ".git", "dist", ".local"]);
    const stack = [repoRoot];
    while (stack.length) {
      const cur = stack.pop()!;
      let entries;
      try {
        entries = fs.readdirSync(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const p = path.join(cur, e.name);
        const rel = path.relative(repoRoot, p).replace(/\\/g, "/");
        if (ignore.has(e.name)) continue;
        if (e.isDirectory()) stack.push(p);
        else if (e.isFile()) results.push(rel);
      }
    }
    results.sort();
    return results;
  }
}

export function collectFileHashes(repoRoot: string, filePaths?: string[]): FileHashEntry[] {
  const files = filePaths ?? listTrackedFiles(repoRoot);
  const entries: FileHashEntry[] = [];
  for (const rel of files) {
    const abs = path.join(repoRoot, rel);
    try {
      const stat = fs.statSync(abs);
      if (!stat.isFile()) continue;
      entries.push({ path: rel, hash: sha256File(abs), size: stat.size });
    } catch {
      // missing file -> skip (treat as change if expected)
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

export function captureGitStatus(repoRoot: string): string {
  try {
    return execSync("git status --porcelain=v1", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20000,
    }).trim();
  } catch (e: any) {
    return `[git-status-error] ${(e?.message ?? String(e)).slice(0, 400)}`;
  }
}
