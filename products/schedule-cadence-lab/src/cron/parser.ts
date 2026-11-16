import type {
  CronError,
  FieldKind,
  FieldSpec,
  ParseFail,
  ParseResult,
  ParsedCron,
} from './types';

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const DOW_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const FIELDS: FieldSpec[] = [
  { kind: 'minute', label: 'minute', min: 0, max: 59 },
  { kind: 'hour', label: 'hour', min: 0, max: 23 },
  { kind: 'dayOfMonth', label: 'day of month', min: 1, max: 31 },
  { kind: 'month', label: 'month', min: 1, max: 12, names: MONTH_NAMES },
  {
    kind: 'dayOfWeek',
    label: 'day of week',
    min: 0,
    max: 7,
    names: DOW_NAMES,
    normalize: (v) => (v === 7 ? 0 : v),
  },
];

function fail(field: FieldKind | 'expression', label: string, message: string, value: string): ParseFail {
  return { ok: false, error: { field, fieldLabel: label, message, value } };
}

function uniqSorted(nums: number[]): number[] {
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

function parseValueToken(
  token: string,
  spec: FieldSpec,
): { ok: true; value: number } | { ok: false; error: CronError } {
  const lower = token.toLowerCase();
  let value: number | undefined;
  if (spec.names && lower in spec.names) {
    value = spec.names[lower];
  } else if (/^[+-]?\d+$/.test(token)) {
    value = parseInt(token, 10);
  }
  if (value === undefined) {
    return {
      ok: false,
      error: {
        field: spec.kind,
        fieldLabel: spec.label,
        message: `Unknown ${spec.label} value "${token}".`,
        value: token,
      },
    };
  }
  if (value < spec.min || value > spec.max) {
    return {
      ok: false,
      error: {
        field: spec.kind,
        fieldLabel: spec.label,
        message: `${spec.label} value ${value} is out of range (${spec.min}–${spec.max}).`,
        value: token,
      },
    };
  }
  return { ok: true, value: spec.normalize ? spec.normalize(value) : value };
}

function parseField(
  token: string,
  spec: FieldSpec,
): { ok: true; values: number[] } | { ok: false; error: CronError } {
  const parts = token.split(',');
  if (parts.length === 0 || parts.some((p) => p === '')) {
    return {
      ok: false,
      error: {
        field: spec.kind,
        fieldLabel: spec.label,
        message: `Invalid ${spec.label} field "${token}".`,
        value: token,
      },
    };
  }

  const values: number[] = [];
  for (const part of parts) {
    // step: base/step
    let base = part;
    let step: number | undefined;
    const slashIdx = part.indexOf('/');
    if (slashIdx !== -1) {
      base = part.slice(0, slashIdx);
      const stepStr = part.slice(slashIdx + 1);
      if (!/^\d+$/.test(stepStr)) {
        return {
          ok: false,
          error: {
            field: spec.kind,
            fieldLabel: spec.label,
            message: `Invalid step "${stepStr}" in ${spec.label} field.`,
            value: token,
          },
        };
      }
      step = parseInt(stepStr, 10);
      if (step <= 0) {
        return {
          ok: false,
          error: {
            field: spec.kind,
            fieldLabel: spec.label,
            message: `Invalid step ${step} in ${spec.label} field: step must be greater than 0.`,
            value: token,
          },
        };
      }
    }

    let rangeStart: number;
    let rangeEnd: number;
    const rangeMax = spec.max; // for */step upper bound; dow 7 normalizes

    if (base === '*') {
      rangeStart = spec.min;
      rangeEnd = rangeMax;
    } else if (base.includes('-')) {
      const dashParts = base.split('-');
      if (dashParts.length !== 2) {
        return {
          ok: false,
          error: {
            field: spec.kind,
            fieldLabel: spec.label,
            message: `Invalid range "${base}" in ${spec.label} field.`,
            value: token,
          },
        };
      }
      const a = parseValueToken(dashParts[0], spec);
      if (!a.ok) return a;
      const b = parseValueToken(dashParts[1], spec);
      if (!b.ok) return b;
      if (a.value > b.value) {
        return {
          ok: false,
          error: {
            field: spec.kind,
            fieldLabel: spec.label,
            message: `Reversed range ${a.value}-${b.value} in ${spec.label} field.`,
            value: token,
          },
        };
      }
      rangeStart = a.value;
      rangeEnd = b.value;
    } else {
      const single = parseValueToken(base, spec);
      if (!single.ok) return single;
      if (step === undefined) {
        values.push(single.value);
        continue;
      }
      rangeStart = single.value;
      rangeEnd = rangeMax;
    }

    // effective upper bound for dow is 6 when normalized domain matters
    const upper = spec.kind === 'dayOfWeek' ? 6 : rangeEnd;
    const start = spec.kind === 'dayOfWeek' ? (rangeStart === 7 ? 0 : rangeStart) : rangeStart;
    const end = spec.kind === 'dayOfWeek' ? (rangeEnd === 7 ? 6 : rangeEnd) : upper;
    const stepVal = step ?? 1;

    for (let v = start; v <= end; v += stepVal) {
      values.push(spec.normalize ? spec.normalize(v) : v);
    }
  }

  const normalized = uniqSorted(values);
  if (normalized.length === 0) {
    return {
      ok: false,
      error: {
        field: spec.kind,
        fieldLabel: spec.label,
        message: `${spec.label} field "${token}" produces no values.`,
        value: token,
      },
    };
  }
  return { ok: true, values: normalized };
}

export function parseCron(input: string): ParseResult {
  if (input === undefined || input === null) {
    return fail('expression', 'expression', 'Expression is required.', String(input));
  }
  const trimmed = String(input).trim();
  if (trimmed === '') {
    return fail('expression', 'expression', 'Start typing a cron expression.', '');
  }
  // split on whitespace (repeated/leading/trailing tolerated)
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);

  if (parts.length !== 5) {
    if (parts.length === 6 || parts.some((p) => p.startsWith('@'))) {
      return fail(
        'expression',
        'expression',
        parts.some((p) => p.startsWith('@'))
          ? 'Unsupported @-macro. Use a 5-field cron expression (minute hour day-of-month month day-of-week).'
          : 'Six-field (seconds) expressions are not supported. Use a 5-field cron expression (minute hour day-of-month month day-of-week).',
        trimmed,
      );
    }
    return fail(
      'expression',
      'expression',
      `Expected 5 fields (minute hour day-of-month month day-of-week) but found ${parts.length}.`,
      trimmed,
    );
  }

  const results = FIELDS.map((spec, i) => parseField(parts[i], spec));
  for (const r of results) {
    if (!r.ok) return r;
  }

  const [minute, hour, dom, month, dow] = results.map((r) => (r as { ok: true; values: number[] }).values);
  const parsed: ParsedCron = {
    minute,
    hour,
    dayOfMonth: dom,
    month,
    dayOfWeek: dow,
    sources: {
      minute: parts[0],
      hour: parts[1],
      dayOfMonth: parts[2],
      month: parts[3],
      dayOfWeek: parts[4],
    },
    raw: trimmed,
  };
  return { ok: true, parsed };
}

export function isEvery(values: number[], min: number, max: number): boolean {
  if (values.length !== max - min + 1) return false;
  for (let i = 0, v = min; v <= max; i++, v++) {
    if (values[i] !== v) return false;
  }
  return true;
}

export function fieldSpecs(): FieldSpec[] {
  return FIELDS;
}
