/**
 * Starter social platform adapter.
 *
 * This is a *template* adapter showing the shape of a real platform integration.
 * It does NOT call any live social API until you wire credentials in and mark
 * `publishingEnabled: true`.
 */

import {
  PlatformConstraints,
  PreparedPost,
  SocialAdapter,
  register,
  validateCaption,
  validateMime,
} from "../social/base.js";

const constraints: PlatformConstraints = {
  id: "x",
  name: "X / Twitter",
  maxCaptionChars: 280,
  preferredAspectRatios: ["1:1", "16:9"],
  preferredDimensions: ["1024x1024", "1200x675"],
  acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  publishingEnabled: false, // flip to true only after wiring X API credentials
};

export const xAdapter: SocialAdapter = {
  id: constraints.id,
  constraints,
  prepare(input) {
    const captionIssues = validateCaption(input.caption, constraints.maxCaptionChars).issues;
    const mimeIssues = validateMime(input.mimeType, constraints.acceptedMimeTypes).issues;
    const issues = [...captionIssues, ...mimeIssues];

    let caption = input.caption;
    if (input.hashtags?.length) {
      caption = `${caption.trim()}\n\n${input.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")}`;
    }

    return {
      platformId: constraints.id,
      caption,
      altText: input.altText,
      hashtags: input.hashtags ?? [],
      imagePath: input.imagePath,
      imageFilename: input.imageFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      validation: { ok: issues.length === 0, issues },
    };
  },
  async publish(prepared) {
    // TODO: implement X API v2 POST /2/tweets with media upload.
    return {
      ok: false,
      note: "X publishing not implemented yet. Enable via src/social/x.ts + X API credentials.",
    };
  },
};

register(xAdapter);