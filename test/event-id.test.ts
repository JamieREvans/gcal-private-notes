import { describe, expect, it } from 'vitest';
import { decodeEid, encodeEid, eventRefFromEid, toEventRef } from '../lib/event-id';

const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('decodeEid', () => {
  it('decodes event and calendar ids and expands abbreviated domains', () => {
    expect(decodeEid(b64url('abc123 jane@m'))).toEqual({ eventId: 'abc123', calendarId: 'jane@gmail.com' });
    expect(decodeEid(b64url('abc123 team123@g'))).toEqual({
      eventId: 'abc123',
      calendarId: 'team123@group.calendar.google.com',
    });
    expect(decodeEid(b64url('abc123 jane@example.com'))).toEqual({
      eventId: 'abc123',
      calendarId: 'jane@example.com',
    });
  });

  it('rejects garbage', () => {
    expect(decodeEid('not base64 at all!')).toBeNull();
    expect(decodeEid(b64url('onlyonepart'))).toBeNull();
  });

  it('round-trips with encodeEid', () => {
    const eid = encodeEid('abc123_20261019T150000Z', 'jane@gmail.com');
    expect(eid).toBe(b64url('abc123_20261019T150000Z jane@m'));
    expect(decodeEid(eid)).toEqual({ eventId: 'abc123_20261019T150000Z', calendarId: 'jane@gmail.com' });
  });
});

describe('toEventRef', () => {
  it('treats single events as their own series', () => {
    expect(toEventRef('abc123', 'jane@gmail.com')).toEqual({
      key: 'jane@gmail.com|abc123',
      calendarId: 'jane@gmail.com',
      eventId: 'abc123',
      seriesId: 'abc123',
      instanceStart: undefined,
    });
  });

  it('parses timed recurring instances', () => {
    const ref = toEventRef('abc123_20261019T150000Z', 'c');
    expect(ref.seriesId).toBe('abc123');
    expect(ref.instanceStart).toBe('2026-10-19T15:00:00Z');
  });

  it('parses all-day recurring instances', () => {
    const ref = toEventRef('abc123_20261019', 'c');
    expect(ref.seriesId).toBe('abc123');
    expect(ref.instanceStart).toBe('2026-10-19');
  });

  it('groups "this and following" splits with the original series', () => {
    expect(toEventRef('abc123_R20260101T100000_20261019T100000Z', 'c').seriesId).toBe('abc123');
  });

  it('builds a ref straight from an eid', () => {
    expect(eventRefFromEid(b64url('abc_20261019T150000Z jane@m'))?.key).toBe('jane@gmail.com|abc_20261019T150000Z');
  });
});
