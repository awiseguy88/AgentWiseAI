// Bundled pricing table (USD per 1M tokens) for common models, plus helpers.
// Costs may be overridden per-step via cost_usd in the log.

export const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-2024-08-06": { input: 2.5, output: 10.0 },
  "gpt-4o-2024-05-13": { input: 5.0, output: 15.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
};

export function priceStep(model: string | undefined, inputTokens: number, outputTokens: number): number {
  const p = model ? PRICING[model] : undefined;
  if (!p) {
    // Fallback: treat unknown model as mid-tier.
    return (inputTokens * 2.5 + outputTokens * 10.0) / 1_000_000;
  }
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export function resolveCost(step: { cost_usd?: number; model?: string; input_tokens: number; output_tokens: number }): number {
  if (typeof step.cost_usd === "number" && Number.isFinite(step.cost_usd)) return step.cost_usd;
  return priceStep(step.model, step.input_tokens, step.output_tokens);
}