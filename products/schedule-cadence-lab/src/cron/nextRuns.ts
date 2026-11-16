import type { ParsedCron, NextRun } from './types';
import { isEvery } from './parser';

function addLocalMinutes(date: Date, minutes: number): Date {
  const result = new Date(date.getTime());
  result.setMinutes(date.getMinutes() + minutes);
  return result;
}

function monthMatch(date: Date, months: number[]): boolean {
  return months.includes(date.getMonth() + 1);
}

function dayMatch(
  date: Date,
  dom: number[],
  dow: number[],
  domRestricted: boolean,
  dowRestricted: boolean,
): boolean {
  const domOk = !domRestricted || dom.includes(date.getDate());
  const dowOk = !dowRestricted || dow.includes(date.getDay());
  if (domRestricted && dowRestricted) return domOk || dowOk; // standard cron union
  return domOk && dowOk;
}

/** Format a Date in local time as a friendly absolute timestamp. */
export function formatAbsolute(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Resolve the local time-zone label (never silently mixed with UTC). */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** A plain relative hint for a future datetime compared with `now`. */
export function relativeHint(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) return `in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDiff = Math.round((targetDay.getTime() - nowDay.getTime()) / 86400000);
  if (dayDiff === 1) return 'tomorrow';
  if (dayDiff <= 7) return `in ${dayDiff} days`;
  return `in ${dayDiff} days`;
}

/**
 * Compute the next N future run timestamps from `now`, evaluated in local time
 * only. Runs strictly after `now`. Deterministic across day/month/year
 * boundaries, leap days, and DST transitions because iteration walks civil
 * local wall-clock minutes one at a time.
 */
export function nextRuns(parsed: ParsedCron, now: Date, count: number = 5): NextRun[] {
  const results: NextRun[] = [];
  if (count <= 0) return results;

  const domRestricted = !isEvery(parsed.dayOfMonth, 1, 31);
  const dowRestricted = !isEvery(parsed.dayOfWeek, 0, 6);
  const hours = parsed.hour;
  const minutes = parsed.minute;

  // Start at the beginning of now's local day and walk forward minute by minute.
  let cursor = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const maxDate = new Date(now.getFullYear() + 5, 0, 1); // generous stop (~5 years)

  while (cursor < maxDate && results.length < count) {
    if (!monthMatch(cursor, parsed.month)) {
      // jump to the first day of the next month
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        1,
        0,
        0,
        0,
      );
      continue;
    }
    if (!dayMatch(cursor, parsed.dayOfMonth, parsed.dayOfWeek, domRestricted, dowRestricted)) {
      cursor = addLocalMinutes(cursor, 24 * 60);
      continue;
    }
    for (const hour of hours) {
      for (const minute of minutes) {
        const candidate = new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          hour,
          minute,
          0,
          0,
        );
        if (candidate.getTime() <= now.getTime()) continue;
        results.push({
          datetime: candidate,
          absolute: formatAbsolute(candidate),
          relative: relativeHint(candidate, now),
        });
        if (results.length === count) return results;
      }
    }
    cursor = addLocalMinutes(cursor, 24 * 60);
  }
  return results;
}
