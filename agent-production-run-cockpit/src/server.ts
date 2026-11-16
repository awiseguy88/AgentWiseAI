import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { NormalizedRun } from "./types.js";
import { normalizeRuns, readJsonl } from "./ingest.js";
import { buildReport, renderHtml } from "./report.js";

export class Server {
  private runs: NormalizedRun[] = [];
  private source = "";
  private port: number;
  private outDir: string;

  constructor(port: number, source: string, outDir = "report-output") {
    this.port = port;
    this.source = source;
    this.outDir = outDir;
    this.reload();
  }

  reload(): void {
    try {
      const recs = readJsonl(this.source);
      this.runs = normalizeRuns(recs);
    } catch {
      this.runs = [];
    }
  }

  private send(res: http.ServerResponse, status: number, body: string | Buffer, ct = "text/plain; charset=utf-8"): void {
    res.writeHead(status, { "Content-Type": ct, "Access-Control-Allow-Origin": "*" });
    res.end(body as any);
  }

  start(): http.Server {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/health") {
        this.send(res, 200, JSON.stringify({ ok: true, runs: this.runs.length }), "application/json");
        return;
      }
      if (url.pathname === "/api/report") {
        const src = url.searchParams.get("file") || this.source;
        try {
          const runs = normalizeRuns(readJsonl(src));
          const report = buildReport(runs, src);
          this.send(res, 200, JSON.stringify(report, null, 2), "application/json");
        } catch (e: any) {
          this.send(res, 400, JSON.stringify({ error: e?.message ?? String(e) }), "application/json");
        }
        return;
      }
      if (url.pathname === "/") {
        this.send(res, 200, "<!doctype html><html><head><meta charset=utf-8><title>Cockpit</title></head><body><h1>Agent Production Run Cockpit</h1><p><a href=/api/report>Report JSON</a> | <a href=/health>Health</a></p></body></html>", "text/html");
        return;
      }
      // static files from public/
      const pub = path.join(process.cwd(), "public");
      const f = path.join(pub, url.pathname.replace(/^\//, ""));
      if (fs.existsSync(f) && fs.statSync(f).isFile()) {
        const ext = path.extname(f);
        const ct = ext === ".html" ? "text/html" : ext === ".css" ? "text/css" : ext === ".js" ? "text/javascript" : "application/octet-stream";
        const buf = fs.readFileSync(f);
        this.send(res, 200, buf.toString("base64"), "application/octet-stream");
        return;
      }
      this.send(res, 404, "not found");
    });
    srv.listen(this.port, () => {
      process.stderr.write(`Cockpit listening on http://localhost:${this.port}\n`);
    });
    return srv;
  }
}