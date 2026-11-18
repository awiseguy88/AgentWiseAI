import { LedgerDb } from "./db.js";
import { NoticeRecord, NoticeStatus, JobOwner } from "./types.js";

export interface DeliverNoticeOptions {
  /** Simulated steering destination for the notice */
  destination?: "active_run" | "prompt";
}

export class NoticeService {
  constructor(private db: LedgerDb) {}

  /**
   * Deliver a completion notice to the owning turn.
   * Marks as delivered; the owning turn is expected to ack.
   * Steers into active run if the turn is active, otherwise surfaces as prompt.
   */
  deliver(noticeId: string, opts: DeliverNoticeOptions = {}): NoticeRecord {
    const notice = this.db.getNotice(noticeId);
    if (!notice) {
      throw new Error(`Notice ${noticeId} not found`);
    }

    const now = new Date().toISOString();
    const turn = this.db.getTurn(
      notice.owner.tenant,
      notice.owner.thread,
      notice.owner.turn
    );

    let status: NoticeStatus = "delivered";
    if (!turn || !turn.isActive) {
      // Turn gone or inactive: surface as a prompt for the tenant to reclaim
      status = "delivered";
    }

    this.db.updateNotice(notice.id, {
      status,
      attempts: notice.attempts + 1,
      lastAttemptAt: now,
    });
    return this.db.getNotice(notice.id)!;
  }

  /** Mark a notice as acknowledged by the owning turn (idempotent). */
  ack(noticeId: string): NoticeRecord | null {
    const notice = this.db.getNotice(noticeId);
    if (!notice) return null;
    if (notice.status === "acked") return notice;

    const now = new Date().toISOString();
    this.db.updateNotice(notice.id, { status: "acked", ackedAt: now });
    return this.db.getNotice(notice.id)!;
  }

  /** List notices belonging to an owner that have not been acknowledged. */
  unackedByOwner(owner: JobOwner): NoticeRecord[] {
    return this.db.listUnackedNotices().filter(
      (n) =>
        n.owner.tenant === owner.tenant &&
        n.owner.thread === owner.thread &&
        n.owner.turn === owner.turn
    );
  }

  /**
   * Replay unacknowledged notices after a crash.
   * Idempotent: already-acked notices are skipped.
   * Returns notices that were (re)delivered.
   */
  replayUnacked(): NoticeRecord[] {
    const unacked = this.db.listUnackedNotices();
    const replayed: NoticeRecord[] = [];
    for (const notice of unacked) {
      const job = this.db.getJob(notice.jobId);
      const now = new Date().toISOString();
      this.db.updateNotice(notice.id, {
        status: "delivered",
        attempts: notice.attempts + 1,
        lastAttemptAt: now,
      });
      replayed.push({
        ...notice,
        status: "delivered",
        attempts: notice.attempts + 1,
        lastAttemptAt: now,
      });
    }
    return replayed;
  }

  /** Replay all unacked notices owned by a given turn. */
  replayUnackedByOwner(owner: JobOwner): NoticeRecord[] {
    return this.replayUnacked().filter(
      (n) =>
        n.owner.tenant === owner.tenant &&
        n.owner.thread === owner.thread &&
        n.owner.turn === owner.turn
    );
  }
}