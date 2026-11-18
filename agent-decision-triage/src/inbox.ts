import { computeDedupeKey } from "./dedupe";
import { deliverResponse, DeliverOptions } from "./deliver";
import { TriageDb } from "./db";
import type { BatchResolvePayload, DecisionItem, NeedsInfoPayload, ResolvePayload, SnoozePayload, SubmitItem } from "./types";
import { resolveRestrictions, type DeliveryRestrictions } from "./restrictions";

const TYPE_PRIORITY: Record<string, number> = {
  approval: 40,
  "done-claim": 30,
  review: 20,
  question: 10,
};

export interface QueueItemView extends DecisionItem {
  queueNumber: number | null;
  duplicates: DecisionItem[];
  isDuplicate: boolean;
}

export function submitItem(db: TriageDb, input: SubmitItem): { item: DecisionItem; deduped: boolean } {
  const dedupeKey = computeDedupeKey(input);
  if (dedupeKey) {
    const existing = db.findPendingByDedupeKey(dedupeKey);
    if (existing) {
      const group = existing.duplicateGroup || existing.id;
      const item = db.insertItem({
        type: input.type,
        priority: input.priority ?? TYPE_PRIORITY[input.type] ?? 0,
        source: (input.context.agent as string) || null,
        session: (input.context.session as string) || null,
        summary: input.context.summary,
        context: input.context,
        channel: input.channel,
        channelTarget: input.channelTarget,
        dedupeKey,
        linkedTo: existing.id,
        duplicateGroup: group,
      });
      // ensure primary marked with group id for easier grouping
      if (!existing.duplicateGroup) {
        // lightweight update via audit note not necessary; group derived by linkedTo/id in queries
      }
      return { item, deduped: true };
    }
  }
  const item = db.insertItem({
    type: input.type,
    priority: input.priority ?? TYPE_PRIORITY[input.type] ?? 0,
    source: (input.context.agent as string) || null,
    session: (input.context.session as string) || null,
    summary: input.context.summary,
    context: input.context,
    channel: input.channel,
    channelTarget: input.channelTarget,
    dedupeKey,
    linkedTo: null,
    duplicateGroup: null,
  });
  return { item, deduped: false };
}

export function listQueue(db: TriageDb): QueueItemView[] {
  const items = db.listItems();
  const byId = new Map(items.map((i) => [i.id, i]));
  // Build duplicate groups: primary id -> list including linked items
  const groupMap = new Map<number, DecisionItem[]>();
  for (const item of items) {
    if (item.linkedTo) {
      const primary = item.linkedTo;
      const arr = groupMap.get(primary) || [];
      arr.push(item);
      groupMap.set(primary, arr);
    }
  }

  const primaryPending = items
    .filter((i) => !i.linkedTo && ["pending", "snoozed", "needs-info"].includes(i.status))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.id - b.id;
    });

  let n = 0;
  const views: QueueItemView[] = [];
  for (const item of primaryPending) {
    n += 1;
    const dups = (groupMap.get(item.id) || []).filter((d) => ["pending", "snoozed", "needs-info", "resolved", "failed"].includes(d.status));
    views.push({ ...item, queueNumber: n, duplicates: dups, isDuplicate: false });
  }

  // Include resolved/failed primaries not in active queue? keep queue as actionable inbox; full list available separately.
  return views;
}

export function listAllWithQueueNumbers(db: TriageDb): QueueItemView[] {
  const active = listQueue(db);
  const activeIds = new Set(active.map((i) => i.id));
  const items = db.listItems();
  const groupMap = new Map<number, DecisionItem[]>();
  for (const item of items) {
    if (item.linkedTo) {
      const arr = groupMap.get(item.linkedTo) || [];
      arr.push(item);
      groupMap.set(item.linkedTo, arr);
    }
  }
  const result: QueueItemView[] = [...active];
  for (const item of items) {
    if (item.linkedTo || activeIds.has(item.id)) continue;
    if (!["resolved", "failed"].includes(item.status)) continue;
    result.push({ ...item, queueNumber: null, duplicates: groupMap.get(item.id) || [], isDuplicate: false });
  }
  return result.sort((a, b) => (a.queueNumber ?? 999999) - (b.queueNumber ?? 999999) || a.id - b.id);
}

function resolutionTargets(db: TriageDb, id: number): DecisionItem[] {
  const item = db.getItem(id);
  if (!item) return [];
  const primaryId = item.linkedTo || item.id;
  const primary = db.getItem(primaryId);
  if (!primary) return [];
  const all = [primary, ...db.listItems().filter((i) => i.linkedTo === primaryId)];
  // deliver to any item in group that has not been delivered/resolved as its own waiting caller? include pending/snoozed/needs-info.
  return all.filter((i) => ["pending", "snoozed", "needs-info"].includes(i.status));
}

export async function resolveItemWithDelivery(
  db: TriageDb,
  id: number,
  payload: ResolvePayload,
  opts: DeliverOptions & { restrictions?: DeliveryRestrictions } = {}
): Promise<{ resolved: DecisionItem[]; failed: Array<{ item: DecisionItem; error: string }> }> {
  const responder = payload.responder || "operator";
  const restrictions = opts.restrictions || resolveRestrictions();
  const targets = resolutionTargets(db, id);
  const resolved: DecisionItem[] = [];
  const failed: Array<{ item: DecisionItem; error: string }> = [];
  for (const target of targets) {
    const updated = db.resolveItem(target.id, payload.response, responder)!;
    const delivery = await deliverResponse(updated, payload.response, { ...opts, restrictions });
    if (delivery.ok) {
      db.recordDeliverySuccess(target.id, delivery.attempts);
      resolved.push(db.getItem(target.id)!);
    } else {
      db.markFailed(target.id, `${delivery.diagnostic.message} ${delivery.diagnostic.lastError || ""}`.trim(), delivery.diagnostic.attempts);
      failed.push({ item: db.getItem(target.id)!, error: delivery.diagnostic.lastError || delivery.diagnostic.message });
    }
  }
  return { resolved, failed };
}

export async function batchResolve(db: TriageDb, payload: BatchResolvePayload, opts: DeliverOptions & { restrictions?: DeliveryRestrictions } = {}) {
  const results: Array<{ id: number; resolved: number[]; failed: Array<{ id: number; error: string }> }> = [];
  for (const r of payload.resolutions) {
    const out = await resolveItemWithDelivery(db, r.id, { response: r.response, responder: r.responder }, opts);
    results.push({
      id: r.id,
      resolved: out.resolved.map((i) => i.id),
      failed: out.failed.map((f) => ({ id: f.item.id, error: f.error })),
    });
  }
  return results;
}

export function snooze(db: TriageDb, id: number, payload: SnoozePayload) {
  const until = payload.until || new Date(Date.now() + 30 * 60 * 1000).toISOString();
  return db.snoozeItem(id, until, payload.reason);
}

export function needsInfo(db: TriageDb, id: number, payload: NeedsInfoPayload) {
  return db.needsInfoItem(id, payload.question);
}