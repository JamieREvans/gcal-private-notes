/**
 * Identity of a Google Calendar event occurrence, derived from the `eid`
 * token Google Calendar uses in URLs and the DOM.
 *
 * An `eid` is URL-safe base64 of "<eventId> <calendarId>". For recurring
 * events the eventId is an instance id: "<seriesId>_<YYYYMMDD[THHMMSSZ]>".
 */
export interface EventRef {
  /** Stable storage key for this occurrence. */
  key: string;
  calendarId: string;
  /** Instance id for recurring occurrences, plain id otherwise. */
  eventId: string;
  /** Groups occurrences of the same recurring series (equals eventId if not recurring). */
  seriesId: string;
  /** ISO date or date-time parsed from the instance suffix, if any. */
  instanceStart?: string;
}

// Google abbreviates common calendar domains inside eids.
const CALENDAR_SUFFIXES: Record<string, string> = {
  '@m': '@gmail.com',
  '@g': '@group.calendar.google.com',
  '@v': '@group.v.calendar.google.com',
  '@i': '@import.calendar.google.com',
};

const INSTANCE_SUFFIX = /^(.+)_(\d{8})(?:T(\d{6})Z?)?$/;
// "This and following" edits split a series into "<id>_R<date>[T<time>]".
const SPLIT_SUFFIX = /_R\d{8}(?:T\d{6}Z?)?$/;

export function decodeEid(eid: string): { eventId: string; calendarId: string } | null {
  try {
    let b64 = eid.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const decoded = atob(b64);
    const [eventId, calendarId, ...rest] = decoded.split(' ');
    if (!eventId || !calendarId || rest.length > 0) return null;
    if (!/^[\x21-\x7e]+$/.test(eventId + calendarId)) return null;
    return { eventId, calendarId: normalizeCalendarId(calendarId) };
  } catch {
    return null;
  }
}

export function normalizeCalendarId(calendarId: string): string {
  for (const [short, full] of Object.entries(CALENDAR_SUFFIXES)) {
    if (calendarId.endsWith(short)) return calendarId.slice(0, -short.length) + full;
  }
  return calendarId;
}

export function toEventRef(eventId: string, calendarId: string): EventRef {
  const match = INSTANCE_SUFFIX.exec(eventId);
  let seriesId = eventId;
  let instanceStart: string | undefined;
  if (match) {
    const [, base, date, time] = match as unknown as [string, string, string, string | undefined];
    seriesId = base;
    instanceStart = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    if (time) instanceStart += `T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`;
  }
  seriesId = seriesId.replace(SPLIT_SUFFIX, '');
  return { key: `${calendarId}|${eventId}`, calendarId, eventId, seriesId, instanceStart };
}

export function eventRefFromEid(eid: string): EventRef | null {
  const decoded = decodeEid(eid);
  return decoded ? toEventRef(decoded.eventId, decoded.calendarId) : null;
}

/** Inverse of decodeEid, used for links back to an event. */
export function encodeEid(eventId: string, calendarId: string): string {
  let cal = calendarId;
  for (const [short, full] of Object.entries(CALENDAR_SUFFIXES)) {
    if (cal.endsWith(full)) {
      cal = cal.slice(0, -full.length) + short;
      break;
    }
  }
  return btoa(`${eventId} ${cal}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
