import { browser } from 'wxt/browser';
import type { EventRef } from './event-id';
import type { EventSnapshot } from './notes-store';

export interface CurrentEvent {
  ref: EventRef;
  snapshot: EventSnapshot;
  at: number;
}

export type Message =
  | { type: 'open-options' }
  | { type: 'open-upgrade' }
  | { type: 'open-login' }
  | { type: 'refresh-license' }
  | { type: 'current-event'; event: CurrentEvent }
  | { type: 'visible-events'; refs: EventRef[] };

export const CURRENT_EVENT_KEY = 'currentEvent';
/** Events currently shown in Calendar (session memory only), for the side panel's "Today". */
export const VISIBLE_EVENTS_KEY = 'visibleEvents';

export function sendMessage(message: Message): void {
  // The background may be asleep or reloading; nothing here needs a reply.
  browser.runtime.sendMessage(message).catch(() => {});
}
