export interface Example {
  key: string;
  expression: string;
  title: string;
  description: string;
}

export const EXAMPLES: Example[] = [
  {
    key: 'every-minute',
    expression: '* * * * *',
    title: 'Every minute',
    description: 'Runs every minute.',
  },
  {
    key: 'every-5-minutes',
    expression: '*/5 * * * *',
    title: 'Every 5 minutes',
    description: 'Runs every 5 minutes.',
  },
  {
    key: 'every-hour',
    expression: '0 * * * *',
    title: 'Every hour',
    description: 'Runs at minute 0 of every hour.',
  },
  {
    key: 'daily-2am',
    expression: '0 2 * * *',
    title: 'Daily at 02:00',
    description: 'Runs at 02:00 every day.',
  },
  {
    key: 'weekdays-9am',
    expression: '0 9 * * 1-5',
    title: 'Weekdays at 09:00',
    description: 'Runs at 09:00 on weekdays (Monday–Friday).',
  },
  {
    key: 'monthly-first',
    expression: '0 0 1 * *',
    title: 'Monthly on the 1st',
    description: 'Runs at midnight on the 1st of every month.',
  },
  {
    key: 'leap-day-feb-29',
    expression: '0 0 29 2 *',
    title: 'February 29 (leap years)',
    description: 'Runs at midnight on February 29 in leap years.',
  },
  {
    key: '1st-and-15th',
    expression: '30 4 1,15 * *',
    title: '04:30 on the 1st and 15th',
    description: 'Runs at 04:30 on the 1st and 15th of every month.',
  },
  {
    key: 'sunday-midnight',
    expression: '0 0 * * 7',
    title: 'Sundays at midnight',
    description: 'Runs at midnight on Sundays (day-of-week 7 = Sunday).',
  },
  {
    key: 'mondays-january',
    expression: '15 10 * JAN MON',
    title: 'Mondays in January at 10:15',
    description: 'Runs at 10:15 on Mondays in January.',
  },
  {
    key: 'yearly-jan-1',
    expression: '0 0 1 1 *',
    title: 'Yearly on January 1',
    description: 'Runs at midnight on January 1 every year.',
  },
  {
    key: 'business-hours',
    expression: '*/15 9-17 * * 1-5',
    title: 'Business hours every 15 minutes',
    description: 'Runs every 15 minutes between 09:00 and 17:00 on weekdays.',
  },
];

export const REFERENCE = {
  title: 'Field reference',
  intro: 'A cron expression has 5 whitespace-separated fields: minute hour day-of-month month day-of-week.',
  fields: [
    { label: 'Minute', values: '0–59', special: '* / , -', example: '*/15' },
    { label: 'Hour', values: '0–23', special: '* / , -', example: '9-17' },
    { label: 'Day of month', values: '1–31', special: '* / , -', example: '1,15' },
    { label: 'Month', values: '1–12 (or JAN–DEC)', special: '* / , -', example: 'JAN' },
    { label: 'Day of week', values: '0–7 (0 and 7 = Sunday, or SUN–SAT)', special: '* / , -', example: '1-5' },
  ],
  specialChars: [
    { char: '*', meaning: 'Any value.' },
    { char: ',', meaning: 'List of values (e.g. 1,15).' },
    { char: '-', meaning: 'Range of values (e.g. 9-17).' },
    { char: '/', meaning: 'Step values (e.g. */15 means every 15 minutes).' },
  ],
};

export const TIPS = [
  {
    title: 'Day-of-month and day-of-week combine with OR',
    body: 'When both day-of-month and day-of-week are restricted, cron runs if either matches. This can be surprising: "0 0 1 * 0" runs on the 1st of the month AND on Sundays, not only on Sundays that fall on the 1st.',
  },
  {
    title: 'Prefer local time, label it clearly',
    body: 'Next-run times are shown in your browser\u2019s local time zone. If you share schedules across regions, convert to UTC first and label the zone explicitly; never mix UTC and local silently.',
  },
  {
    title: 'Seconds and years are not supported',
    body: 'This lab supports the standard 5 fields only. Six-field expressions that include seconds, and year fields, are not supported. @-macros such as @reboot, @yearly, @monthly, etc., are not recognized.',
  },
  {
    title: '@-macros are not recognized',
    body: 'Shortcuts like @reboot, @daily, @hourly, @weekly, @monthly, and @yearly are not supported. Write the equivalent 5-field expression instead.',
  },
];
