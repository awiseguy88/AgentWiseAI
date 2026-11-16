/**
 * Solo Site Rescue Kit — HTML/CSS rewriting.
 *
 * Replaces remote image URLs in HTML pages and CSS with local asset paths produced by
 * the rescue module. Preserves structure, srcset descriptors, and formatting as much as
 * possible by operating on string replacements keyed by the original extraction refs.
 */

import * as path from "node:path";
import { isDataUri } from "./utils.js";

/**
 * Build a URL -> localPath map from extraction refs that were successfully rescued.
 * Prefers the first localPath for a given original URL.
 */
export function buildUrlMap(extraction) {
  const map = new Map();
  for (const ref of extraction.images) {
    if (!ref.url || isDataUri(ref.url)) continue;
    if (ref.status === "rescued" && ref.localPath) {
      if (!map.has(ref.url)) map.set(ref.url, ref.localPath);
    }
  }
  return map;
}

/** Replace all occurrences of original URLs in a text with local paths. */
export function rewriteText(text, urlMap) {
  let out = text;
  // Replace longer URLs first to avoid partial-prefix collisions.
  const entries = [...urlMap.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [original, local] of entries) {
    if (!original) continue;
    // Replace plain and HTML-encoded ampersands in srcset-like contexts.
    const escaped = escapeRegExp(original);
    out = out.replace(new RegExp(escaped, "g"), local);
  }
  return out;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rewrite all pages in an extraction using the rescued URL map.
 * Returns a new array of { path, name, html } with rewritten content.
 */
export function rewritePages(extraction, urlMap) {
  return extraction.pages.map((page) => ({
    ...page,
    html: rewriteText(page.html, urlMap),
  }));
}

/** Rewrite CSS files if present in the inventory. */
export function rewriteCss(extraction, urlMap) {
  return extraction.cssFiles.map((css) => ({
    ...css,
    css: rewriteText(css.css, urlMap),
  }));
}
