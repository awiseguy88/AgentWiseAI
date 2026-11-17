import { execSync } from "node:child_process";
import fs from "node:fs";

/**
 * Assert a single acceptance criterion.
 *
 * Supported kinds:
 *  - { kind: "file-exists", path }
 *  - { kind: "file-matches", path, pattern } (RegExp string or regex)
 *  - { kind: "command-exits-zero", command }
 *  - { kind: "command-output-matches", command, pattern }
 *  - { kind: "git-status-clean", repoRoot }
 *
 * Returns { ok, detail }.
 */
export function assertCriterion(kind: object, repoRoot: string): { ok: boolean; detail: string } {
  const k: any = kind;
  try {
    switch (k.kind) {
      case "file-exists": {
        const ok = fs.existsSync(k.path);
        return { ok, detail: ok ? `${k.path} exists` : `${k.path} missing` };
      }
      case "file-matches": {
        const exists = fs.existsSync(k.path);
        if (!exists) return { ok: false, detail: `${k.path} missing` };
        const content = fs.readFileSync(k.path, "utf8");
        const re = k.pattern instanceof RegExp ? k.pattern : new RegExp(k.pattern);
        const ok = re.test(content);
        return { ok, detail: ok ? `${k.path} matches /${re}/` : `${k.path} does not match /${re}/` };
      }
      case "command-exits-zero": {
        try {
          execSync(k.command, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"], timeout: 60000 });
          return { ok: true, detail: `command "${k.command}" exited 0` };
        } catch (e: any) {
          const code = (e as { status?: number }).status ?? "unknown";
          return { ok: false, detail: `command "${k.command}" exited ${code}` };
        }
      }
      case "command-output-matches": {
        try {
          const out = execSync(k.command, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000 });
          const re = k.pattern instanceof RegExp ? k.pattern : new RegExp(k.pattern);
          const ok = re.test(out);
          return { ok, detail: ok ? `command output matches /${re}/` : `command output does not match /${re}/` };
        } catch (e: any) {
          return { ok: false, detail: `command "${k.command}" failed to run` };
        }
      }
      case "git-status-clean": {
        try {
          const out = execSync("git status --porcelain", { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
          return { ok: out.length === 0, detail: out.length === 0 ? "working tree clean" : `dirty: ${out.slice(0, 200)}` };
        } catch (e: any) {
          return { ok: false, detail: `git status failed: ${(e as Error).message}` };
        }
      }
      default:
        return { ok: false, detail: `unknown criterion kind: ${k.kind}` };
    }
  } catch (e: any) {
    return { ok: false, detail: `criterion evaluation error: ${(e as Error).message}` };
  }
}