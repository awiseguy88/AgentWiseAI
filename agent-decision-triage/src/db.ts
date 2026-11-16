import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type { AuditRecord, DecisionItem, DecisionType, ItemStatus, SubmitContext } from "./types";

export interface DbOptions {
  dbPath?: string;
}

function nowIso() {
  return new Date().toISOString();
}

export class TriageDb {
  private db: Database.Database;

  constructor(opts: DbOptions = {}) {
    const dbPath = opts.dbPath || path.join(process.cwd(), ".local", "triage.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,
        source TEXT,
        session TEXT,
        summary TEXT NOT NULL,
        context_json TEXT NOT NULL,
        channel TEXT NOT NULL,
        channel_target TEXT NOT NULL,
        dedupe_key TEXT,
        linked_to INTEGER,
        duplicate_group INTEGER,
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        resolved_by TEXT,
        response_json TEXT,
        delivery_attempts INTEGER NOT NULL DEFAULT 0,
        delivery_error TEXT,
        snooze_until TEXT,
        needs_info_question TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
      CREATE INDEX IF NOT EXISTS idx_items_dedupe ON items(dedupe_key);
      CREATE INDEX IF NOT EXISTS idx_items_linked ON items(linked_to);
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        actor TEXT,
        detail TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(item_id) REFERENCES items(id)
      );
      CREATE INDEX IF NOT EXISTS idx_audit_item ON audit(item_id);
    `);
  }

  close() {
    this.db.close();
  }

  insertItem(input: {
    type: DecisionType;
    priority: number;
    source: string | null;
    session: string | null;
    summary: string;
    context: SubmitContext;
    channel: string;
    channelTarget: string;
    dedupeKey: string | null;
    linkedTo: number | null;
    duplicateGroup: number | null;
  }): DecisionItem {
    const createdAt = nowIso();
    const info = this.db
      .prepare(
        `INSERT INTO items (type, status, priority, source, session, summary, context_json, channel, channel_target, dedupe_key, linked_to, duplicate_group, created_at)
         VALUES (@type, 'pending', @priority, @source, @session, @summary, @contextJson, @channel, @channelTarget, @dedupeKey, @linkedTo, @duplicateGroup, @createdAt)`
      )
      .run({
        type: input.type,
        priority: input.priority,
        source: input.source,
        session: input.session,
        summary: input.summary,
        contextJson: JSON.stringify(input.context),
        channel: input.channel,
        channelTarget: input.channelTarget,
        dedupeKey: input.dedupeKey,
        linkedTo: input.linkedTo,
        duplicateGroup: input.duplicateGroup,
        createdAt,
      });
    const item = this.getItem(Number(info.lastInsertRowid))!;
    this.addAudit(item.id, "submitted", null, JSON.stringify({ type: item.type, session: item.session, linkedTo: item.linkedTo }));
    return item;
  }

  getItem(id: number): DecisionItem | null {
    const row = this.db.prepare("SELECT * FROM items WHERE id = ?").get(id) as any;
    return row ? this.rowToItem(row) : null;
  }

  listItems(): DecisionItem[] {
    const rows = this.db.prepare("SELECT * FROM items ORDER BY id ASC").all() as any[];
    return rows.map((r) => this.rowToItem(r));
  }

  findPendingByDedupeKey(dedupeKey: string): DecisionItem | null {
    const row = this.db
      .prepare(
        "SELECT * FROM items WHERE dedupe_key = ? AND linked_to IS NULL AND status IN ('pending','snoozed','needs-info') ORDER BY id ASC LIMIT 1"
      )
      .get(dedupeKey) as any;
    return row ? this.rowToItem(row) : null;
  }

  listGroupItems(groupId: number): DecisionItem[] {
    const rows = this.db
      .prepare("SELECT * FROM items WHERE id = ? OR duplicate_group = ? OR linked_to = ? ORDER BY id ASC")
      .all(groupId, groupId, groupId) as any[];
    return rows.map((r) => this.rowToItem(r));
  }

  resolveItem(id: number, response: unknown, responder: string): DecisionItem | null {
    const resolvedAt = nowIso();
    this.db
      .prepare(
        `UPDATE items SET status='resolved', resolved_at=@resolvedAt, resolved_by=@responder, response_json=@responseJson, needs_info_question=NULL
         WHERE id=@id`
      )
      .run({ id, resolvedAt, responder, responseJson: JSON.stringify(response) });
    this.addAudit(id, "resolved", responder, JSON.stringify({ response, resolvedAt }));
    return this.getItem(id);
  }

  markFailed(id: number, error: string, attempts: number): DecisionItem | null {
    this.db
      .prepare("UPDATE items SET status='failed', delivery_attempts=@attempts, delivery_error=@error WHERE id=@id")
      .run({ id, attempts, error });
    this.addAudit(id, "delivery_failed", null, JSON.stringify({ error, attempts }));
    return this.getItem(id);
  }

  recordDeliverySuccess(id: number, attempts: number): DecisionItem | null {
    this.db
      .prepare("UPDATE items SET delivery_attempts=@attempts, delivery_error=NULL WHERE id=@id")
      .run({ id, attempts });
    this.addAudit(id, "delivered", null, JSON.stringify({ attempts }));
    return this.getItem(id);
  }

  snoozeItem(id: number, until: string | null, reason?: string): DecisionItem | null {
    this.db.prepare("UPDATE items SET status='snoozed', snooze_until=? WHERE id=?").run(until, id);
    this.addAudit(id, "snoozed", null, JSON.stringify({ until, reason }));
    return this.getItem(id);
  }

  needsInfoItem(id: number, question: string): DecisionItem | null {
    this.db.prepare("UPDATE items SET status='needs-info', needs_info_question=? WHERE id=?").run(question, id);
    this.addAudit(id, "needs_info", null, JSON.stringify({ question }));
    return this.getItem(id);
  }

  addAudit(itemId: number, action: string, actor: string | null, detail: string | null) {
    this.db
      .prepare("INSERT INTO audit (item_id, action, actor, detail, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(itemId, action, actor, detail, nowIso());
  }

  listAudit(): AuditRecord[] {
    const rows = this.db.prepare("SELECT * FROM audit ORDER BY id ASC").all() as any[];
    return rows.map((r) => ({
      id: r.id,
      itemId: r.item_id,
      action: r.action,
      actor: r.actor,
      detail: r.detail,
      createdAt: r.created_at,
    }));
  }

  private rowToItem(r: any): DecisionItem {
    return {
      id: r.id,
      type: r.type as DecisionType,
      status: r.status as ItemStatus,
      priority: r.priority,
      source: r.source,
      session: r.session,
      summary: r.summary,
      context: JSON.parse(r.context_json),
      channel: r.channel,
      channelTarget: r.channel_target,
      dedupeKey: r.dedupe_key,
      linkedTo: r.linked_to,
      duplicateGroup: r.duplicate_group,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      resolvedBy: r.resolved_by,
      response: r.response_json ? JSON.parse(r.response_json) : null,
      deliveryAttempts: r.delivery_attempts,
      deliveryError: r.delivery_error,
      snoozeUntil: r.snooze_until,
      needsInfoQuestion: r.needs_info_question,
    };
  }
}

export function defaultDbPath() {
  return path.join(process.cwd(), ".local", "triage.db");
}
