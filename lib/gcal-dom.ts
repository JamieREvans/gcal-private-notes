import { eventRefFromEid, type EventRef } from './event-id';
import type { EventSnapshot } from './notes-store';

/**
 * Every Google Calendar selector lives here. Calendar's class names are
 * obfuscated and change often, so we only rely on semantic hooks: roles,
 * data-* attributes, URL shapes and the stable "x…" ids Calendar uses for
 * its own tests and accessibility. Last verified: October 2026.
 */
export const SEL = {
  /** Event chips in day/week/month grids and "more" overflow lists. */
  chip: '[data-eventchip][data-eventid]',
  dialog: '[role="dialog"]',
  eventIdHolder: '[data-eventid]',
  /** Popup: the date/time block, which also contains the title heading. */
  popupWhen: '#xDetDlgWhen',
  /** Full event page. */
  pageTitle: '#xTiIn',
  pageStartDate: '#xStDaIn',
  pageStartTime: '#xStTiIn',
  pageAllDay: '#xAlDaCbx input',
  pageDescription: '#xDesc',
  main: '[role="main"]',
} as const;

const EVENT_PAGE_PATH = /\/r\/eventedit\/([A-Za-z0-9_-]+)(?:[/?#]|$)/;
const ACCOUNT_PREFIX = /^\/calendar\/u\/\d+/;

export interface Mountpoint {
  ref: EventRef;
  /** Element the notes box is inserted into, and the node to insert before (null = append). */
  parent: Element;
  before: Node | null;
  snapshot: () => EventSnapshot;
  /** Identity of the surrounding UI, so we can tell when it has been replaced. */
  owner: Element;
}

export function eventUrl(eid: string, loc: Pick<Location, 'origin' | 'pathname'> = location): string {
  const account = ACCOUNT_PREFIX.exec(loc.pathname)?.[0] ?? '/calendar';
  return `${loc.origin}${account}/r/eventedit/${eid}`;
}

function text(el: Element | null | undefined): string {
  return (el as HTMLElement | null)?.innerText?.trim() || el?.textContent?.trim() || '';
}

/** Event details popups (the bubble that opens when an event is clicked). */
export function findPopups(root: ParentNode = document): Mountpoint[] {
  const found: Mountpoint[] = [];
  for (const dialog of root.querySelectorAll(SEL.dialog)) {
    const eid = dialog.querySelector(SEL.eventIdHolder)?.getAttribute('data-eventid');
    const ref = eid ? eventRefFromEid(eid) : null;
    if (!eid || !ref) continue;

    // The "when" block sits in a column of detail rows; we add ours at the end.
    const when = dialog.querySelector(SEL.popupWhen);
    const rows = when?.parentElement?.parentElement;
    const parent = rows ?? dialog.querySelector(SEL.eventIdHolder)?.parentElement ?? dialog;

    found.push({
      ref,
      parent,
      before: null,
      owner: dialog,
      snapshot: () => {
        const titleId = dialog.getAttribute('aria-labelledby');
        const title = text(titleId ? dialog.ownerDocument.getElementById(titleId) : null);
        const lines = text(dialog.querySelector(SEL.popupWhen))
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const when = lines.find((l) => l !== title);
        return { title: title || undefined, when, url: eventUrl(eid) };
      },
    });
  }
  return found;
}

/** The full event page (/r/eventedit/<eid>). */
export function findEventPage(root: Document = document, loc: Pick<Location, 'origin' | 'pathname'> = location): Mountpoint | null {
  const eid = EVENT_PAGE_PATH.exec(loc.pathname)?.[1];
  const ref = eid ? eventRefFromEid(eid) : null;
  const main = root.querySelector(SEL.main);
  if (!eid || !ref || !main) return null;

  const description = root.querySelector(SEL.pageDescription);
  const titleInput = root.querySelector<HTMLInputElement>(SEL.pageTitle);
  let parent: Element;
  let before: Node | null;
  if (description?.parentElement) {
    parent = description.parentElement;
    before = description;
  } else if (titleInput?.parentElement?.parentElement) {
    parent = titleInput.parentElement.parentElement;
    before = null;
  } else {
    parent = main;
    before = main.firstElementChild?.nextSibling ?? null;
  }

  return {
    ref,
    parent,
    before,
    owner: main,
    snapshot: () => {
      const title = root.querySelector<HTMLInputElement>(SEL.pageTitle)?.value.trim();
      const date = root.querySelector<HTMLInputElement>(SEL.pageStartDate)?.value.trim();
      const allDay = root.querySelector<HTMLInputElement>(SEL.pageAllDay)?.checked;
      const time = allDay ? '' : root.querySelector<HTMLInputElement>(SEL.pageStartTime)?.value.trim();
      return { title: title || undefined, when: [date, time].filter(Boolean).join(' ') || undefined, url: eventUrl(eid, loc) };
    },
  };
}

/** Grid chips with the note key they belong to. Composite chips (e.g. working location) are skipped. */
export function findChips(root: ParentNode = document): { el: HTMLElement; ref: EventRef }[] {
  const chips: { el: HTMLElement; ref: EventRef }[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(SEL.chip)) {
    const ref = eventRefFromEid(el.getAttribute('data-eventid') ?? '');
    if (ref) chips.push({ el, ref });
  }
  return chips;
}
