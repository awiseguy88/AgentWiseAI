/**
 * Social platform adapter interface and constraint registry.
 *
 * Adapters are intentionally minimal: for v0.1 the focus is on *preparing*
 * platform-ready posts (caption + image + alt text + validation) without
 * necessarily publishing. Publishing adapters opt into real API calls behind
 * `SOCIAL_ENABLED_PLATFORMS`.
 */

export interface PlatformConstraints {
  id: string;
  name: string;
  /** Max caption characters (recommendation/hard limit hint). */
  maxCaptionChars?: number;
  /** Preferred image aspect ratios, e.g. ["1:1", "4:5", "9:16"]. */
  preferredAspectRatios?: string[];
  /** Preferred image dimensions in pixels, e.g. ["1024x1024", "1080x1350"]. */
  preferredDimensions?: string[];
  /** Accepted mime types. */
  acceptedMimeTypes?: string[];
  /** True if real publishing is wired up for this adapter. */
  publishingEnabled: boolean;
}

export interface PreparedPost {
  platformId: string;
  caption: string;
  altText?: string;
  hashtags: string[];
  imagePath: string;
  imageFilename: string;
  mimeType: string;
  sizeBytes: number;
  validation: {
    ok: boolean;
    issues: string[];
  };
}

export interface SocialAdapter {
  id: string;
  constraints: PlatformConstraints;
  /** Validate caption/image and build a platform-ready payload preview. */
  prepare(input: {
    caption: string;
    imagePath: string;
    imageFilename: string;
    mimeType: string;
    sizeBytes: number;
    altText?: string;
    hashtags?: string[];
  }): PreparedPost;
  /** Publish (only when `publishingEnabled` and configured). Dry-run by default. */
  publish?(input: PreparedPost): Promise<{ ok: boolean; postUrl?: string; note?: string }>;
}

const REGISTRY: SocialAdapter[] = [];

export function register(adapter: SocialAdapter) {
  REGISTRY.push(adapter);
}

export function listAdapters(): SocialAdapter[] {
  return REGISTRY;
}

export function getAdapter(id: string): SocialAdapter | undefined {
  return REGISTRY.find((a) => a.id === id);
}

/** Helper for caption validation shared across adapters. */
export function validateCaption(caption: string, maxChars?: number) {
  const issues: string[] = [];
  if (!caption || caption.trim().length === 0) issues.push("Caption is empty");
  if (maxChars && caption.length > maxChars)
    issues.push(`Caption exceeds ${maxChars} characters (${caption.length})`);
  return { ok: issues.length === 0, issues };
}

/** Helper for image mime validation shared across adapters. */
export function validateMime(mimeType: string, accepted: string[] | undefined) {
  const issues: string[] = [];
  if (accepted && !accepted.includes(mimeType)) {
    issues.push(
      `Image mime type ${mimeType} not accepted by platform; accepted: ${accepted.join(", ")}`
    );
  }
  return { ok: issues.length === 0, issues };
}