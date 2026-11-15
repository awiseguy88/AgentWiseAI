/**
 * Thin HTTP client for a local Lemonade server.
 *
 * Maps `GenerateRequest` -> Lemonade generate endpoints and handles both
 * synchronous (image returned immediately) and asynchronous (job polling)
 * flows, returning local file paths via `saveImageAsset`.
 */

// Uses the global `fetch` available in Node.js 18+. No extra dependency.
import { config } from "../config.js";
import { saveImageAsset } from "../storage/assets.js";
import {
  GenerateRequest,
  GenerateResponse,
  JobStatusResponse,
  LemonadeHealth,
} from "./types.js";

interface ClientConfig extends Pick<
  typeof config.lemonade,
  "baseUrl" | "apiKey" | "timeoutMs"
> {}

export class LemonadeClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(cfg: ClientConfig = config.lemonade) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, "");
    this.apiKey = cfg.apiKey;
    this.timeoutMs = cfg.timeoutMs;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    try {
      const res = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Lemonade ${res.status} for ${path}: ${text}`);
      }
      // Allow binary/image content types as well as JSON.
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return (await res.json()) as T;
      }
      return (await res.text()) as unknown as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Health check against Lemonade. */
  async health(): Promise<LemonadeHealth> {
    try {
      const data = await this.request<LemonadeHealth>("/health");
      return { ...data, status: "ok" };
    } catch (err) {
      return { status: "degraded" };
    }
  }

  /** Generate one or more images. Returns local asset metadata after saving. */
  async generate(req: GenerateRequest) {
    const payload = {
      prompt: req.prompt,
      ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
      ...(req.size ? { size: req.size } : {}),
      ...(req.model ? { model: req.model } : {}),
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
      ...(req.count ? { count: req.count } : {}),
      ...(req.extra ?? {}),
    };

    const resp = await this.request<GenerateResponse>("/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Synchronous result: images returned directly.
    if (!resp.pending && resp.imagesBase64?.length) {
      return await this.saveBase64Images(resp.imagesBase64, req);
    }
    if (!resp.pending && resp.images?.length) {
      return await this.downloadAndSaveImages(resp.images, req);
    }

    // Async flow: poll until complete.
    if (resp.pending || resp.jobId) {
      const jobId = resp.jobId || (resp as unknown as { jobId?: string }).jobId;
      if (!jobId) {
        throw new Error("Lemonade returned pending result without job id");
      }
      return await this.pollJob(jobId, req);
    }

    throw new Error("Lemonade returned an unrecognized generation response");
  }

  /** Poll an asynchronous generation job until completion. */
  async pollJob(jobId: string, req: GenerateRequest) {
    const maxAttempts = Math.ceil(this.timeoutMs / 2_000);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, 2_000));
      const status = await this.request<JobStatusResponse>(`/jobs/${jobId}`);
      if (status.status === "completed") {
        if (status.imagesBase64?.length) {
          return await this.saveBase64Images(status.imagesBase64, req, {
            jobId: status.jobId,
          });
        }
        if (status.images?.length) {
          return await this.downloadAndSaveImages(status.images, req, {
            jobId: status.jobId,
          });
        }
        throw new Error(`Job ${jobId} completed but produced no images`);
      }
      if (status.status === "failed") {
        throw new Error(
          `Lemonade job ${jobId} failed: ${status.error ?? "unknown error"}`
        );
      }
    }
    throw new Error(`Lemonade job ${jobId} did not complete in time`);
  }

  private async saveBase64Images(
    uris: string[],
    req: GenerateRequest,
    jobMeta?: { jobId?: string }
  ) {
    const assets = [];
    for (const uri of uris) {
      const buffer = uriToBuffer(uri);
      const asset = await saveImageAsset({
        prompt: req.prompt,
        negativePrompt: req.negativePrompt,
        params: { model: req.model, size: req.size, seed: req.seed, ...req.extra, ...jobMeta },
        buffer,
        extension: "png",
      });
      assets.push(asset);
    }
    return { images: assets, jobId: jobMeta?.jobId };
  }

  private async downloadAndSaveImages(
    urls: string[],
    req: GenerateRequest,
    jobMeta?: { jobId?: string }
  ) {
    const assets = [];
    for (const url of urls) {
      const res = await fetch(url, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to download image ${url}: ${res.status}`);
      const ab = await res.arrayBuffer();
      const buffer = new Uint8Array(ab);
      const ext = detectExtension(url, res.headers.get("content-type") ?? undefined);
      const asset = await saveImageAsset({
        prompt: req.prompt,
        negativePrompt: req.negativePrompt,
        params: { model: req.model, size: req.size, seed: req.seed, ...req.extra, ...jobMeta },
        buffer,
        extension: ext,
      });
      assets.push(asset);
    }
    return { images: assets, jobId: jobMeta?.jobId };
  }
}

/** Parse a base64 data URI into raw bytes. */
function uriToBuffer(dataUri: string): Uint8Array {
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri);
  if (!match) throw new Error(`Unrecognized data URI scheme: ${dataUri.slice(0, 80)}`);
  const base64 = match[2];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Guess file extension from URL / content-type. */
function detectExtension(url: string, contentType?: string): string {
  const ext = /\.(png|jpg|jpeg|webp|gif)([?#].*)?$/i.exec(url)?.[1]?.toLowerCase();
  if (ext) return ext;
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("gif")) return "gif";
  return "png";
}