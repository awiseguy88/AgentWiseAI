import { BudgetDecision } from "./types.js";

export class BudgetCap {
  private cap: number;
  private spent = 0;
  private stopped = false;
  private stoppedAt?: string;

  constructor(capUsd: number) {
    this.cap = capUsd;
  }

  canSpend(step: string, amount: number): BudgetDecision {
    if (this.stopped) {
      return {
        allowed: false,
        spent_usd: this.spent,
        cap_usd: this.cap,
        remaining_usd: Math.max(0, this.cap - this.spent),
        stopped_at_step: this.stoppedAt,
        reason: `budget cap already enforced at step ${this.stoppedAt}`,
      };
    }
    const next = this.spent + amount;
    if (next > this.cap) {
      this.stopped = true;
      this.stoppedAt = step;
      return {
        allowed: false,
        spent_usd: this.spent,
        cap_usd: this.cap,
        remaining_usd: Math.max(0, this.cap - this.spent),
        stopped_at_step: step,
        reason: `budget cap exceeded: would spend $${next.toFixed(4)} > cap $${this.cap.toFixed(4)}`,
      };
    }
    this.spent = next;
    return {
      allowed: true,
      spent_usd: this.spent,
      cap_usd: this.cap,
      remaining_usd: Math.max(0, this.cap - this.spent),
      reason: "ok",
    };
  }

  snapshot(): BudgetDecision {
    return {
      allowed: !this.stopped,
      spent_usd: this.spent,
      cap_usd: this.cap,
      remaining_usd: Math.max(0, this.cap - this.spent),
      stopped_at_step: this.stoppedAt,
      reason: this.stopped ? `stopped at ${this.stoppedAt}` : "ok",
    };
  }
}