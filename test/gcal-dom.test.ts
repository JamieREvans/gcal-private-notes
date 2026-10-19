import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { eventUrl, findChips, findEventPage, findPopups } from '../lib/gcal-dom';

const fixture = (name: string) => readFileSync(resolve(process.cwd(), 'test/fixtures', name), 'utf8');
const loc = { origin: 'https://calendar.google.com', pathname: '/calendar/u/1/r/week' };

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('event popup', () => {
  it('finds the event, where to insert, and a snapshot', () => {
    document.body.innerHTML = fixture('popup.html');
    const [popup, ...rest] = findPopups();
    expect(rest).toHaveLength(0);
    expect(popup!.ref).toMatchObject({
      calendarId: 'alex@example.com',
      eventId: 'abc123def456_20261019T130000Z',
      seriesId: 'abc123def456',
    });
    expect(popup!.parent.getAttribute('jsname')).toBe('sV9x3c');
    expect(popup!.before).toBeNull();
    const snap = popup!.snapshot();
    expect(snap.title).toBe('Weekly 1:1');
    expect(snap.when).toBe('Monday, October 19⋅9:00 – 9:30am');
    expect(snap.url).toMatch(/\/r\/eventedit\//);
  });

  it('ignores dialogs that are not about an event', () => {
    document.body.innerHTML = '<div role="dialog"><p>Settings</p></div>';
    expect(findPopups()).toEqual([]);
  });
});

describe('full event page', () => {
  it('mounts before the description and reads title and time', () => {
    document.body.innerHTML = fixture('event-page.html');
    const eid = 'b25ldGltZTc4OSBhbGV4QG0'; // "onetime789 alex@m"
    const page = findEventPage(document, { origin: loc.origin, pathname: `/calendar/u/0/r/eventedit/${eid}` });
    expect(page!.ref).toMatchObject({ calendarId: 'alex@gmail.com', eventId: 'onetime789' });
    expect((page!.before as Element).id).toBe('xDesc');
    expect(page!.snapshot()).toMatchObject({ title: 'Quarterly planning', when: 'Thursday, October 22 2:00pm' });
  });

  it('ignores the new-event and other pages', () => {
    document.body.innerHTML = fixture('event-page.html');
    expect(findEventPage(document, { ...loc, pathname: '/calendar/u/0/r/eventedit' })).toBeNull();
    expect(findEventPage(document, { ...loc, pathname: '/calendar/u/0/r/eventedit/duplicate/abc' })).toBeNull();
    expect(findEventPage(document, loc)).toBeNull();
  });
});

describe('grid chips', () => {
  it('returns decodable chips and skips composite ones', () => {
    document.body.innerHTML = fixture('week.html');
    expect(findChips().map((c) => c.ref.eventId)).toEqual(['abc123def456_20261019T130000Z', 'onetime789']);
  });
});

describe('eventUrl', () => {
  it('keeps the signed-in account index', () => {
    expect(eventUrl('EID', loc)).toBe('https://calendar.google.com/calendar/u/1/r/eventedit/EID');
  });
});
