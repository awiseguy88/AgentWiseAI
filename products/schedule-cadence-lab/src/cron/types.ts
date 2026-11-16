export type FieldKind =
  | 'minute'
  | 'hour'
  | 'dayOfMonth'
  | 'month'
  | 'dayOfWeek';

export interface FieldSpec {
  kind: FieldKind;
  label: string;
  min: number;
  max: number;
  names?: Record<string, number>;
  normalize?: (value: number) => number;
}

export interface ParsedCron {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
  /** Original token per field, used by the describer to recognize step patterns. */
  sources: Record<FieldKind, string>;
  raw: string;
}

export interface CronError {
  field: FieldKind | 'expression';
  fieldLabel: string;
  message: string;
  value: string;
}

export interface ParseOk {
  ok: true;
  parsed: ParsedCron;
}
export interface ParseFail {
  ok: false;
  error: CronError;
}
export type ParseResult = ParseOk | ParseFail;

export interface FieldBreakdown {
  field: FieldKind;
  label: string;
  values: number[];
  description: string;
}

export interface DescribeOk {
  ok: true;
  description: string;
  breakdown: FieldBreakdown[];
}
export interface DescribeFail {
  ok: false;
  error: CronError;
}
export type DescribeResult = DescribeOk | DescribeFail;

export interface NextRun {
  datetime: Date;
  absolute: string;
  relative: string;
}
