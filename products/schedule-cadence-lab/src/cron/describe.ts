import { isEvery } from './parser';
import type { DescribeResult, FieldBreakdown, ParsedCron } from './types';

const MONTH_LONG = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pad2(n: number): string { return n.toString().padStart(2, '0'); }

function listNames(values: number[], names: string[]): string {
  if (values.length === 1) return names[values[0]];
  if (values.length === 2) return `${names[values[0]]} and ${names[values[1]]}`;
  return values.map((v) => names[v]).join(', ');
}

function contiguous(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}

function describeMinutes(p: ParsedCron): { text: string; everyMin: boolean } {
  const m = p.minute;
  const src = p.sources.minute;
  if (isEvery(m, 0, 59)) return { text: 'every minute', everyMin: true };
  if (m.length === 1) return { text: `at minute ${m[0]}`, everyMin: false };
  // step pattern like */15 or 0-59/15
  const stepMatch = src.match(/^(?:\*|0-59)\/(\d+)$/);
  if (stepMatch) return { text: `every ${stepMatch[1]} minutes`, everyMin: false };
  if (contiguous(m)) return { text: `every minute from ${m[0]} through ${m[m.length - 1]}`, everyMin: false };
  return { text: `at minutes ${m.join(', ')}`, everyMin: false };
}

function describeHours(p: ParsedCron): string {
  const h = p.hour;
  const src = p.sources.hour;
  if (isEvery(h, 0, 23)) return 'every hour';
  if (h.length === 1) return `at ${pad2(h[0])}`;
  const stepMatch = src.match(/^(?:\*|0-23)\/(\d+)$/);
  if (stepMatch) return `every ${stepMatch[1]} hours`;
  if (contiguous(h)) return `every hour from ${pad2(h[0])} through ${pad2(h[h.length - 1])}`;
  return `at hours ${h.map(pad2).join(', ')}`;
}

function describeTime(p: ParsedCron): string {
  const m = p.minute;
  const h = p.hour;
  const mSrc = p.sources.minute;
  const hSrc = p.sources.hour;
  // single time of day
  if (m.length === 1 && h.length === 1) {
    return `at ${pad2(h[0])}:${pad2(m[0])}`;
  }
  // every minute / every N minutes with any hour
  if (isEvery(m, 0, 59) && isEvery(h, 0, 23)) return 'every minute';
  const mStep = mSrc.match(/^(?:\*|0-59)\/(\d+)$/);
  if (mStep && isEvery(h, 0, 23)) return `every ${mStep[1]} minutes`;
  if (mStep && h.length === 1) return `every ${mStep[1]} minutes during hour ${pad2(h[0])}`;
  const hStep = hSrc.match(/^(?:\*|0-23)\/(\d+)$/);
  if (m.length === 1 && hStep) return `at minute ${m[0]} past every ${hStep[1]} hours`;
  if (m.length === 1 && !isEvery(h, 0, 23)) return `at minute ${m[0]} past ${describeHours(p).replace(/^at /, 'hours ')}`;
  return `${describeMinutes(p).text} past ${describeHours(p)}`;
}

function describeDow(values: number[]): string {
  const set = [...values].sort((a, b) => a - b);
  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [0, 6];
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  if (same(set, weekdays)) return 'on weekdays (Monday–Friday)';
  if (same(set, weekend)) return 'on weekends (Saturday–Sunday)';
  if (set.length === 1) return `on ${DOW_LONG[set[0]]}`;
  if (contiguous(set)) return `on ${DOW_LONG[set[0]]} through ${DOW_LONG[set[set.length - 1]]}`;
  return `on ${listNames(set, DOW_LONG)}`;
}

function describeDom(values: number[]): string {
  if (values.length === 1) return `on day ${values[0]} of the month`;
  if (contiguous(values)) return `on days ${values[0]}–${values[values.length - 1]} of the month`;
  return `on days ${values.join(', ')} of the month`;
}

function describeMonth(values: number[]): string {
  if (values.length === 1) return `in ${MONTH_LONG[values[0]]}`;
  if (contiguous(values)) return `from ${MONTH_LONG[values[0]]} through ${MONTH_LONG[values[values.length - 1]]}`;
  return `in ${listNames(values, MONTH_LONG)}`;
}

function buildBreakdown(p: ParsedCron): FieldBreakdown[] {
  return [
    { field: 'minute', label: 'Minute', values: p.minute, description: breakdownMinute(p) },
    { field: 'hour', label: 'Hour', values: p.hour, description: breakdownHour(p) },
    { field: 'dayOfMonth', label: 'Day of month', values: p.dayOfMonth, description: breakdownDom(p) },
    { field: 'month', label: 'Month', values: p.month, description: breakdownMonth(p) },
    { field: 'dayOfWeek', label: 'Day of week', values: p.dayOfWeek, description: breakdownDow(p) },
  ];
}

function breakdownMinute(p: ParsedCron): string {
  if (isEvery(p.minute, 0, 59)) return 'Every minute (0–59)';
  if (p.minute.length === 1) return `At minute ${p.minute[0]}`;
  return `At minutes ${p.minute.join(', ')}`;
}
function breakdownHour(p: ParsedCron): string {
  if (isEvery(p.hour, 0, 23)) return 'Every hour (0–23)';
  if (p.hour.length === 1) return `At ${pad2(p.hour[0])}:00`;
  return `At hours ${p.hour.map(pad2).join(', ')}`;
}
function breakdownDom(p: ParsedCron): string {
  if (isEvery(p.dayOfMonth, 1, 31)) return 'Every day of month (1–31)';
  return `Days ${p.dayOfMonth.join(', ')}`;
}
function breakdownMonth(p: ParsedCron): string {
  if (isEvery(p.month, 1, 12)) return 'Every month (Jan–Dec)';
  return p.month.map((m) => MONTH_LONG[m]).join(', ');
}
function breakdownDow(p: ParsedCron): string {
  if (isEvery(p.dayOfWeek, 0, 6)) return 'Every day of week (Sun–Sat)';
  return p.dayOfWeek.map((d) => DOW_LONG[d]).join(', ');
}

export function describeCron(parsed: ParsedCron): DescribeResult {
  const domRestricted = !isEvery(parsed.dayOfMonth, 1, 31);
  const dowRestricted = !isEvery(parsed.dayOfWeek, 0, 6);
  const monthRestricted = !isEvery(parsed.month, 1, 12);

  const timePart = describeTime(parsed);
  let dayPart = '';
  let domDowNote = '';

  if (domRestricted && dowRestricted) {
    // standard cron OR semantics when both restricted
    dayPart = `${describeDom(parsed.dayOfMonth)} or ${describeDow(parsed.dayOfWeek)}`;
    domDowNote = ' Runs when the day-of-month or day-of-week matches (standard cron union behavior when both are restricted).';
  } else if (dowRestricted) {
    dayPart = describeDow(parsed.dayOfWeek);
  } else if (domRestricted) {
    dayPart = describeDom(parsed.dayOfMonth);
  } else {
    dayPart = 'every day';
  }

  const monthPart = monthRestricted ? ` ${describeMonth(parsed.month)}` : '';

  let sentence = '';
  // craft natural sentences for common cases (A1-A4)
  if (timePart === 'every minute' && !domRestricted && !dowRestricted && !monthRestricted) {
    sentence = 'Runs every minute.';
  } else if (parsed.minute.length === 1 && parsed.hour.length === 1 && isEvery(parsed.minute, 0, 59) === false) {
    // specific time
    sentence = `Runs ${timePart} ${dayPart}${monthPart}.`;
  } else {
    sentence = `Runs ${timePart} ${dayPart}${monthPart}.`;
  }

  sentence = sentence.replace(/\s+/g, ' ').trim() + domDowNote;
  // normalize capitalization/spacing: ensure starts with Runs
  if (!sentence.startsWith('Runs')) sentence = 'Runs ' + sentence;

  return {
    ok: true,
    description: sentence,
    breakdown: buildBreakdown(parsed),
  };
}
