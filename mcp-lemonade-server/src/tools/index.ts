/**
 * Tool schemas and handlers for MCP tools exposed by this server.
 *
 * Lemonade tools: `lemonade_health`, `generate_image`, `list_images`.
 * Social tools: `prepare_social_post`, `publish_social_post`.
 */

import { z } from "zod";
import { config } from "../config.js";
import { LemonadeClient } from "../lemonade/client.js";
import { listRecentAssets } from "../storage/assets.js";
import { getAdapter } from "../social/base.js";

/* ------------------------------------------------------------------ */
/* Input schemas (zod for runtime validation) */

export const LemonadeHealthSchema = z.object({});
export const GenerateImageSchema = z.object({
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  size: z.string().optional(),
  model: z.string().optional(),
  seed: z.number().int().optional(),
  count: z.number().int().min(1).max(4).optional(),
});
export const ListImagesSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
});
export const PrepareSocialPostSchema = z.object({
  platformId: z.string(),
  imagePath: z.string(),
  caption: z.string(),
  altText: z.string().optional(),
  hashtags: z.array(z.string()).optional().default([]),
});
export const PublishSocialPostSchema = z.object({
  platformId: z.string(),
  imagePath: z.string(),
  caption: z.string(),
  altText: z.string().optional(),
  hashtags: z.array(z.string()).optional().default([]),
  confirm: z.boolean().default(false),
});

/* ------------------------------------------------------------------ */
/* MCP tool definitions (JSON Schema for the protocol) */

export const TOOLS = [
  {
    name: "lemonade_health",
    description: "Check whether the local Lemonade server is reachable and healthy.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "generate_image",
    description:
      "Generate one or more images via the local Lemonade server and save them locally.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Text description of the image to generate" },
        negativePrompt: { type: "string", description: "Things to avoid in the image" },
        size: { type: "string", description: "Size/aspect, e.g. 1024x1024 or 16:9" },
        model: { type: "string", description: "Lemonade model/style identifier" },
        seed: { type: "integer", description: "Deterministic seed" },
        count: { type: "integer", minimum: 1, maximum: 4, description: "Number of images" },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "list_images",
    description: "List recently generated image assets stored locally.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "prepare_social_post",
    description:
      "Prepare a platform-ready social post (caption + image + validation). Does not publish.",
    inputSchema: {
      type: "object",
      properties: {
        platformId: { type: "string", description: "Platform id (e.g. x)" },
        imagePath: { type: "string", description: "Absolute path to a generated image asset" },
        caption: { type: "string", description: "Post caption/copy" },
        altText: { type: "string", description: "Alt text for accessibility" },
        hashtags: { type: "array", items: { type: "string" }, description: "Hashtags without #" },
      },
      required: ["platformId", "imagePath", "caption"],
      additionalProperties: false,
    },
  },
  {
    name: "publish_social_post",
    description:
      "Publish a social post. Dry-run unless confirm=true and platform is enabled in SOCIAL_ENABLED_PLATFORMS.",
    inputSchema: {
      type: "object",
      properties: {
        platformId: { type: "string" },
        imagePath: { type: "string" },
        caption: { type: "string" },
        altText: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
        confirm: { type: "boolean", default: false, description: "Set true to actually publish" },
      },
      required: ["platformId", "imagePath", "caption"],
      additionalProperties: false,
    },
  },
] as const;

/* ------------------------------------------------------------------ */
/* Handlers */

type ToolResult = { content: Array<{ type: "text"; text: string }> };
export type ToolHandler = (input: unknown) => Promise<ToolResult>;

const json = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

export function makeLemonadeHealthHandler(client: LemonadeClient): ToolHandler {
  return async () => json(await client.health());
}

export function makeGenerateImageHandler(client: LemonadeClient): ToolHandler {
  return async (input) => {
    const args = GenerateImageSchema.parse(input ?? {});
    const result = await client.generate(args);
    return json({
      ok: true,
      count: result.images.length,
      images: result.images.map((a) => ({
        id: a.id,
        filename: a.filename,
        path: a.absolutePath,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
      jobId: result.jobId,
      prompt: args.prompt,
      params: { size: args.size, model: args.model, seed: args.seed },
    });
  };
}

export function makeListImagesHandler(): ToolHandler {
  return async (input) => {
    const args = ListImagesSchema.parse(input ?? {});
    const assets = await listRecentAssets(args.limit);
    return json({ count: assets.length, images: assets });
  };
}

export function makePrepareSocialPostHandler(): ToolHandler {
  return async (input) => {
    const args = PrepareSocialPostSchema.parse(input ?? {});
    const adapter = getAdapter(args.platformId);
    if (!adapter) return json({ ok: false, error: `Unknown platform: ${args.platformId}` });
    const prepared = adapter.prepare({
      caption: args.caption,
      imagePath: args.imagePath,
      imageFilename: args.imagePath.split("/").pop() ?? args.imagePath,
      mimeType: "image/png", // TODO: read from stored asset metadata
      sizeBytes: 0, // TODO: read from stored asset metadata
      altText: args.altText,
      hashtags: args.hashtags,
    });
    return json({ ok: true, prepared });
  };
}

export function makePublishSocialPostHandler(): ToolHandler {
  return async (input) => {
    const args = PublishSocialPostSchema.parse(input ?? {});
    const adapter = getAdapter(args.platformId);
    if (!adapter) return json({ ok: false, error: `Unknown platform: ${args.platformId}` });
    if (!config.social.enabledPlatforms.includes(args.platformId)) {
      return json({
        ok: false,
        error: `Platform ${args.platformId} is not enabled. Add it to SOCIAL_ENABLED_PLATFORMS.`,
      });
    }
    const prepared = adapter.prepare({
      caption: args.caption,
      imagePath: args.imagePath,
      imageFilename: args.imagePath.split("/").pop() ?? args.imagePath,
      mimeType: "image/png",
      sizeBytes: 0,
      altText: args.altText,
      hashtags: args.hashtags,
    });
    if (!prepared.validation.ok) {
      return json({ ok: false, error: "Validation failed", issues: prepared.validation.issues });
    }
    const dryRun = !args.confirm || config.social.dryRunByDefault;
    if (dryRun || !adapter.publish) {
      return json({
        ok: true,
        dryRun: true,
        note: `Dry-run for ${args.platformId}. Set confirm=true and SOCIAL_DRY_RUN_DEFAULT=false to publish.`,
        prepared,
      });
    }
    const result = await adapter.publish(prepared);
    return json({ ok: result.ok, dryRun: false, postUrl: result.postUrl, note: result.note });
  };
}
