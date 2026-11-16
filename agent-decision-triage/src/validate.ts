import type { SubmitItem, ValidationError } from "./types";

const TYPES = new Set(["question", "approval", "review", "done-claim"]);
const CHANNELS = new Set(["callback", "file", "socket"]);

export function validateSubmitPayload(body: unknown): { ok: true; value: SubmitItem } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: [{ field: "body", message: "Payload must be a JSON object." }] };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.type !== "string" || !TYPES.has(b.type)) {
    errors.push({ field: "type", message: "type must be one of: question, approval, review, done-claim." });
  }

  if (!b.context || typeof b.context !== "object" || Array.isArray(b.context)) {
    errors.push({ field: "context", message: "context must be an object." });
  } else {
    const ctx = b.context as Record<string, unknown>;
    if (typeof ctx.summary !== "string" || ctx.summary.trim().length === 0) {
      errors.push({ field: "context.summary", message: "context.summary is required and must be a non-empty string." });
    }
    if (ctx.links !== undefined) {
      if (!Array.isArray(ctx.links)) {
        errors.push({ field: "context.links", message: "context.links must be an array when provided." });
      } else {
        ctx.links.forEach((l: any, i: number) => {
          if (!l || typeof l !== "object") errors.push({ field: `context.links[${i}]`, message: "link must be an object." });
          else {
            if (typeof l.label !== "string") errors.push({ field: `context.links[${i}].label`, message: "link.label must be a string." });
            if (typeof l.url !== "string") errors.push({ field: `context.links[${i}].url`, message: "link.url must be a string." });
          }
        });
      }
    }
    if (ctx.diff !== undefined) {
      const d = ctx.diff as any;
      if (!d || typeof d !== "object" || Array.isArray(d)) {
        errors.push({ field: "context.diff", message: "context.diff must be an object when provided." });
      } else {
        if (typeof d.path !== "string") errors.push({ field: "context.diff.path", message: "context.diff.path must be a string." });
        if (typeof d.after !== "string") errors.push({ field: "context.diff.after", message: "context.diff.after must be a string." });
      }
    }
  }

  if (typeof b.channel !== "string" || !CHANNELS.has(b.channel)) {
    errors.push({ field: "channel", message: "channel must be one of: callback, file, socket." });
  }
  if (typeof b.channelTarget !== "string" || b.channelTarget.trim().length === 0) {
    errors.push({ field: "channelTarget", message: "channelTarget is required and must be a non-empty string." });
  } else if (b.channel === "callback") {
    try {
      const u = new URL(String(b.channelTarget));
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        errors.push({ field: "channelTarget", message: "callback channelTarget must be an http(s) URL." });
      }
    } catch {
      errors.push({ field: "channelTarget", message: "callback channelTarget must be a valid URL." });
    }
  }

  if (b.priority !== undefined && (typeof b.priority !== "number" || !Number.isFinite(b.priority))) {
    errors.push({ field: "priority", message: "priority must be a finite number when provided." });
  }
  if (b.dedupeKey !== undefined && typeof b.dedupeKey !== "string") {
    errors.push({ field: "dedupeKey", message: "dedupeKey must be a string when provided." });
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      type: b.type as SubmitItem["type"],
      context: b.context as SubmitItem["context"],
      channel: b.channel as SubmitItem["channel"],
      channelTarget: String(b.channelTarget),
      priority: typeof b.priority === "number" ? b.priority : 0,
      dedupeKey: typeof b.dedupeKey === "string" ? b.dedupeKey : undefined,
      expected: Array.isArray(b.expected) ? (b.expected as string[]) : undefined,
    },
  };
}

export function formatErrors(errors: ValidationError[]): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join("; ");
}