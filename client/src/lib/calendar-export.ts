// Calendar Export — turn subscription renewals (and any reminder-style item)
// into RFC 5545 .ics events, plus shortcut URLs for Google Calendar and
// Apple Calendar (via webcal://).
//
// We keep this dependency-free: a hand-rolled .ics writer is a few lines and
// avoids pulling another bundle into the main chunk for what is ultimately a
// once-a-year user action.

export interface CalendarEvent {
  uid: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  /** RFC 5545 RRULE string, e.g. "FREQ=MONTHLY". Omit for one-shot events. */
  rrule?: string;
  reminderMinutesBefore?: number;
  url?: string;
  location?: string;
}

interface SubscriptionLike {
  id: string;
  name: string;
  cost: number;
  currency?: string;
  billingCycle?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextBillingDate: Date | string;
  notes?: string;
  platformLink?: string;
}

const CRLF = '\r\n';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIcsDate(d: Date): string {
  // UTC basic format: YYYYMMDDTHHMMSSZ — broadest compatibility.
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeText(s: string): string {
  // RFC 5545 §3.3.11: backslash, semicolon, comma must be escaped; newlines → \n.
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function rruleForCycle(cycle: SubscriptionLike['billingCycle']): string | undefined {
  switch (cycle) {
    case 'daily': return 'FREQ=DAILY';
    case 'weekly': return 'FREQ=WEEKLY';
    case 'monthly': return 'FREQ=MONTHLY';
    case 'yearly': return 'FREQ=YEARLY';
    default: return undefined;
  }
}

export function subscriptionToEvent(sub: SubscriptionLike): CalendarEvent {
  const start = sub.nextBillingDate instanceof Date
    ? sub.nextBillingDate
    : new Date(sub.nextBillingDate);
  const end = new Date(start.getTime() + 30 * 60 * 1000); // 30-minute event
  const currency = sub.currency || 'INR';
  const title = `${sub.name} renewal · ${currency} ${sub.cost}`;
  return {
    uid: `ironvault-sub-${sub.id}@ironvault.app`,
    title,
    description: sub.notes ? `${title}\n\n${sub.notes}` : title,
    startDate: start,
    endDate: end,
    rrule: rruleForCycle(sub.billingCycle),
    reminderMinutesBefore: 60 * 24, // 1 day before
    url: sub.platformLink || undefined,
  };
}

function buildEventLines(ev: CalendarEvent, dtstamp: string): string[] {
  const lines: string[] = [];
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${ev.uid}`);
  lines.push(`DTSTAMP:${dtstamp}`);
  lines.push(`DTSTART:${toIcsDate(ev.startDate)}`);
  if (ev.endDate) lines.push(`DTEND:${toIcsDate(ev.endDate)}`);
  lines.push(`SUMMARY:${escapeText(ev.title)}`);
  if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
  if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);
  if (ev.url) lines.push(`URL:${ev.url}`);
  if (ev.rrule) lines.push(`RRULE:${ev.rrule}`);
  if (ev.reminderMinutesBefore != null) {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${escapeText(ev.title)}`);
    lines.push(`TRIGGER:-PT${ev.reminderMinutesBefore}M`);
    lines.push('END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

export function buildICS(events: CalendarEvent[]): string {
  const dtstamp = toIcsDate(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IronVault//Subscriptions//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const ev of events) {
    lines.push(...buildEventLines(ev, dtstamp));
  }
  lines.push('END:VCALENDAR');
  return lines.join(CRLF) + CRLF;
}

/** Convenience — turn a list of subscriptions into a full .ics document. */
export function exportToCalendar(subscriptions: SubscriptionLike[]): string {
  const events = subscriptions
    .filter(s => s && s.nextBillingDate)
    .map(subscriptionToEvent);
  return buildICS(events);
}

export function downloadICS(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari has time to handle the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function googleDateRange(start: Date, end: Date): string {
  // Google Calendar accepts the same UTC basic format as iCal but with no
  // separator, e.g. "20260512T100000Z/20260512T103000Z".
  return `${toIcsDate(start)}/${toIcsDate(end)}`;
}

/** Open a pre-filled Google Calendar event in a new tab. */
export function addToGoogleCalendar(sub: SubscriptionLike): void {
  const ev = subscriptionToEvent(sub);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: googleDateRange(ev.startDate, ev.endDate ?? new Date(ev.startDate.getTime() + 30 * 60 * 1000)),
    details: ev.description ?? '',
  });
  if (ev.rrule) params.set('recur', `RRULE:${ev.rrule}`);
  if (ev.url) params.set('location', ev.url);
  const url = `https://calendar.google.com/calendar/render?${params.toString()}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Apple Calendar handles webcal:// URLs natively — but for one-off events the
 *  cleanest UX is still downloading the .ics, which the OS opens in the
 *  default calendar app. We expose a download helper for clarity. */
export function addToAppleCalendar(sub: SubscriptionLike): void {
  const ics = buildICS([subscriptionToEvent(sub)]);
  const safe = sub.name.replace(/[^a-zA-Z0-9-_]/g, '-');
  downloadICS(`${safe}-renewal`, ics);
}
