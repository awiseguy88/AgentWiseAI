/**
 * Lemonade server API surface.
 *
 * Lemonade is a local AI server; this module defines the contract we assume
 * for image generation. Adjust `client.ts` mapping if the real API differs.
 */

export interface LemonadeHealth {
  status: "ok" | "degraded";
  version?: string;
  models?: string[];
  capabilities?: string[];
}

export interface GenerateRequest {
  prompt: string;
  negativePrompt?: string;
  /** e.g. "1024x1024", "16:9", "1:1" */
  size?: string;
  /** Model/style identifier supported by the server. */
  model?: string;
  /** Deterministic seed. */
  seed?: number;
  /** Number of images to generate. */
  count?: number;
  /** Extra provider-specific parameters. */
  extra?: Record<string, unknown>;
}

export interface GenerateResponse {
  /** Server-side job id when generation is async. */
  jobId?: string;
  /** Generated images as URLs (remote or served by Lemonade). */
  images?: string[];
  /** Generated images embedded as base64 data URIs. */
  imagesBase64?: string[];
  /** When true, results are pending and should be polled. */
  pending?: boolean;
  /** Optional metadata echoed back. */
  metadata?: Record<string, unknown>;
}

export interface JobStatusResponse {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  images?: string[];
  imagesBase64?: string[];
  error?: string;
  metadata?: Record<string, unknown>;
}