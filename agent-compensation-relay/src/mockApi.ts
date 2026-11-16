/**
 * Offline mock external API used by the demo and tests.
 * Models side-effecting services an agent might call: reserveStock, chargeCard,
 * sendEmail. Simulates the key failure mode: a write commits server-side but the
 * outcome is unknown (timeout after commit signal).
 */

export class TimeoutError extends Error {
  readonly unknownOutcome: boolean;
  constructor(message: string, unknownOutcome = true) {
    super(message);
    this.name = "TimeoutError";
    this.unknownOutcome = unknownOutcome;
  }
}

export interface MockApiCall {
  tool: string;
  args: unknown;
  ts: string;
}

export interface MockApiBehavior {
  /** Outcome of chargeCard calls. Default simulates timeout-after-commit (unknown). */
  chargeOutcome?: "ok" | "unknown-timeout" | "known-error";
  /** Outcome of sendEmail calls. */
  sendOutcome?: "ok" | "known-error";
}

export class MockExternalApi {
  readonly calls: MockApiCall[] = [];
  /** Server-side effects that committed before any error surfaced. */
  readonly committed: string[] = [];
  behavior: MockApiBehavior;

  constructor(behavior: MockApiBehavior = {}) {
    this.behavior = { chargeOutcome: "unknown-timeout", sendOutcome: "ok", ...behavior };
  }

  count(tool?: string): number {
    if (!tool) return this.calls.length;
    return this.calls.filter((c) => c.tool === tool).length;
  }

  private record(tool: string, args: unknown): void {
    this.calls.push({ tool, args, ts: new Date().toISOString() });
  }

  async reserveStock(args: any): Promise<unknown> {
    this.record("reserveStock", args);
    this.committed.push("reserveStock");
    return { reservationId: "res-1", item: args?.item, qty: args?.qty, committed: true };
  }

  async chargeCard(args: any): Promise<unknown> {
    this.record("chargeCard", args);
    // Commit happens server-side; the outcome may still be unknown to the caller.
    this.committed.push("chargeCard");
    if (this.behavior.chargeOutcome === "unknown-timeout") {
      throw new TimeoutError("charge request timed out after commit signal; outcome unknown", true);
    }
    if (this.behavior.chargeOutcome === "known-error") {
      throw new Error("card declined");
    }
    return { charged: true, amount: args?.amount, committed: true };
  }

  async sendEmail(args: any): Promise<unknown> {
    this.record("sendEmail", args);
    if (this.behavior.sendOutcome === "known-error") {
      throw new Error("SMTP error");
    }
    return { sent: true, messageId: "msg-1", to: args?.to };
  }

  async releaseReservation(args: any): Promise<unknown> {
    this.record("releaseReservation", args);
    return { released: true, reservationId: args?.reservationId };
  }

  async reverseCharge(args: any): Promise<unknown> {
    this.record("reverseCharge", args);
    return { reversed: true, reservationId: args?.reservationId };
  }
}

export type MockToolName =
  | "reserveStock"
  | "chargeCard"
  | "sendEmail"
  | "releaseReservation"
  | "reverseCharge";

export const MOCK_TOOL_NAMES: MockToolName[] = [
  "reserveStock",
  "chargeCard",
  "sendEmail",
  "releaseReservation",
  "reverseCharge",
];
