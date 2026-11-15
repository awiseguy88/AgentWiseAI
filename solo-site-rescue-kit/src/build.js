/**
 * Solo Site Rescue Kit — site builders.
 *
 * Produces either a clean static site (rewritten HTML + assets) or a Next.js App Router
 * scaffold from the rewritten pages and rescued assets.
 */

import * as path from "node:path";
import * as fsp from "node:fs/promises";
import { ensureDir, writeText, sanitizePathSegment } from "./utils.js";

/** Copy a directory's contents recursively. */
export async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isFile()) {
      await ensureDir(path.dirname(d));
      await fsp.copyFile(s, d);
    }
  }
}

/** Build a static site at outDir/static from rewritten pages and assets. */
export async function buildStaticSite({ outDir, rewrittenPages, assetsDir, submissions, options }) {
  const siteDir = path.join(outDir, "site");
  await ensureDir(siteDir);

  // 1. Write rewritten HTML pages.
  for (const page of rewrittenPages) {
    const dest = path.join(siteDir, page.path || page.name);
    await ensureDir(path.dirname(dest));
    await writeText(dest, page.html);
  }

  // 2. Copy rescued image assets (if present).
  const srcAssets = path.join(outDir, "assets");
  try {
    await fsp.access(srcAssets);
    await copyDir(srcAssets, path.join(siteDir, "assets"));
  } catch {
    // no assets rescued
  }

  // 3. Write submissions data if any.
  if (submissions && submissions.length > 0) {
    const dataDir = path.join(siteDir, "data");
    await ensureDir(dataDir);
    const payload = submissions.map((s) => ({ source: s.source, page: s.page, row: s.row, fields: s.fields }));
    await writeText(path.join(dataDir, "submissions.json"), JSON.stringify(payload, null, 2));
  }

  return { kind: "static", path: siteDir };
}

/** Build a Next.js App Router scaffold at outDir/next-app. */
export async function buildNextSite({ outDir, rewrittenPages, submissions, options }) {
  const appDir = path.join(outDir, "next-app");
  const appSrc = path.join(appDir, "app");
  const publicDir = path.join(appDir, "public");
  await ensureDir(appSrc);
  await ensureDir(publicDir);

  // package.json
  const pkg = {
    name: "rescued-site",
    version: "1.0.0",
    private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: { next: "latest", react: "latest", "react-dom": "latest" },
  };
  await writeText(path.join(appDir, "package.json"), JSON.stringify(pkg, null, 2));

  // next.config.mjs
  await writeText(path.join(appDir, "next.config.mjs"), `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nexport default nextConfig;\n`);

  // layout.js
  await writeText(
    path.join(appSrc, "layout.js"),
    `export const metadata = { title: ${JSON.stringify(options?.title || "Rescued Site")} };\nexport default function RootLayout({ children }) {\n  return (<html lang="en"><body>{children}</body></html>);\n}\n`
  );

  // One route per HTML page. index.html -> /, others -> /<slug>.
  for (let i = 0; i < rewrittenPages.length; i++) {
    const page = rewrittenPages[i];
    const base = path.basename(page.path || page.name, path.extname(page.path || page.name));
    const slug = base.toLowerCase() === "index" ? "" : sanitizePathSegment(base);
    const routeDir = slug ? path.join(appSrc, slug) : appSrc;
    await ensureDir(routeDir);
    const escaped = page.html.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
    const component = `export default function Page() {\n  const html = \`${escaped}\`;\n  return <main dangerouslySetInnerHTML={{ __html: html }} />;\n}\n`;
    await writeText(path.join(routeDir, "page.jsx"), component);
  }

  // Copy assets to public/
  const srcAssets = path.join(outDir, "assets");
  try {
    await fsp.access(srcAssets);
    await copyDir(srcAssets, path.join(publicDir, "assets"));
  } catch {
    // no assets
  }

  if (submissions && submissions.length > 0) {
    const dataDir = path.join(appDir, "data");
    await ensureDir(dataDir);
    const payload = submissions.map((s) => ({ source: s.source, page: s.page, row: s.row, fields: s.fields }));
    await writeText(path.join(dataDir, "submissions.json"), JSON.stringify(payload, null, 2));
  }

  return { kind: "next", path: appDir };
}
