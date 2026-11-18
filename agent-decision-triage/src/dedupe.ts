import type { SubmitItem } from "./types";

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ?._:/-]/g, "").trim();
}

/**
 * Compute a dedupe key for a decision item. For clarification questions we
 * normalize the question/summary so near-identical questions across sessions
 * can be linked. Other types can still be explicitly deduped via submit.dedupeKey.
 */
export function computeDedupeKey(item: SubmitItem): string | null {
  if (item.dedupeKey && item.dedupeKey.trim()) return `explicit:${item.dedupeKey.trim()}`;
  if (item.type === "question") {
    const summary = normalizeText(item.context.summary || "");
    const prompt = normalizeText(String(item.context.prompt || ""));
    const basis = summary || prompt;
    if (!basis) return null;
    // Include a coarse context hint (diff path) if present to avoid over-merging unrelated questions.
    const diffPath = item.context.diff?.path ? normalizeText(item.context.diff.path) : "";
    return `question:${basis}::${diffPath}`;
  }
  return null;
}