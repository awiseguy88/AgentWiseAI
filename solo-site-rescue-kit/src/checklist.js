/**
 * Solo Site Rescue Kit — migration checklist generator.
 *
 * Produces a plain Markdown checklist (MIGRATION-CHECKLIST.md) summarizing what was
 * rescued, what needs manual attention, and recommended next steps.
 */

/**
 * Generate a migration checklist as Markdown text.
 */
export function generateChecklist({ run, inventory, extraction, rescueSummary, buildResult, options }) {
  const now = new Date().toISOString();
  const pages = extraction?.pages?.length || 0;
  const submissions = extraction?.submissions?.length || 0;
  const missing = (extraction?.images || []).filter((i) => i.status === "missing");
  const rescued = (extraction?.images || []).filter((i) => i.status === "rescued");
  const dataUris = (extraction?.images || []).filter((i) => i.status === "data-uri");
  const localRefs = (extraction?.images || []).filter((i) => i.status === "local");

  const lines = [];
  lines.push("# Migration Checklist — Solo Site Rescue Kit");
  lines.push("");
  lines.push(`- Generated: ${now}`);
  lines.push(`- Source: \`${run?.sourcePath || ""}\``);
  lines.push(`- Output: \`${run?.outDir || ""}\``);
  lines.push(`- Build: **${buildResult?.kind || "n/a"}** → \`${buildResult?.path || ""}\``);
  lines.push(`- Offline run: ${options?.offline ? "yes" : "no"}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- [ ] Review ${pages} HTML page(s) in the generated site.`);
  lines.push(`- [x] Rescued ${rescued.length} remote image asset(s).`);
  lines.push(`- [${missing.length === 0 ? "x" : " "}] ${missing.length} image asset(s) could not be recovered.`);
  lines.push(`- [${submissions > 0 ? " " : "x"}] ${submissions} submission record(s) exported (review \`data/submissions.json\` if present).`);
  lines.push(`- [ ] Inspect ${dataUris.length} inline data-URI image(s) and ${localRefs.length} local reference(s).`);
  lines.push("");

  if (missing.length > 0) {
    lines.push("## Unrecoverable assets (manual action required)");
    lines.push("");
    for (const img of missing) {
      lines.push(`- [ ] Recover \`${img.url}\` (referenced from \`${img.page || "unknown"}\`, ${img.context || "image"})`);
    }
    lines.push("");
    lines.push("If you can access the original builder or a temporary network connection, re-run the tool without `--offline` so these URLs can be fetched and cached.");
    lines.push("");
  }

  lines.push("## Recommended next steps");
  lines.push("");
  lines.push("- [ ] Open the generated site locally and verify layout, links, and images.");
  lines.push("- [ ] Replace any unrecoverable assets with originals or suitable substitutes.");
  lines.push("- [ ] Review exported submissions/contact data for completeness and privacy before publishing.");
  lines.push("- [ ] Update domain/DNS and hosting once the site looks correct.");
  lines.push("- [ ] Keep this output directory (and `.rescue-cache/`) in version control or a backup.");
  lines.push("- [ ] If you generated a Next.js scaffold, run `npm install` and `npm run dev` inside it to verify.");
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- This tool works offline and does not require paid APIs. Remote rescue is best-effort.");
  lines.push("- Rewrites update image references in HTML/CSS; complex dynamic scripts or builder-specific widgets may need manual fixes.");
  lines.push("- Submissions CSV/JSON are preserved as exported data; treat them as sensitive.");
  lines.push("");
  return lines.join("\n");
}
