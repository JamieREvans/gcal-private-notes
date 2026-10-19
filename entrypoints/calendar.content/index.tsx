import { render } from 'preact';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { NoteEditor } from '../../components/note-editor';
import { STYLES } from '../../components/styles';
import { findChips, findEventPage, findPopups, type Mountpoint } from '../../lib/gcal-dom';
import { getLicense, isPro, onLicenseChanged } from '../../lib/license';
import { sendMessage } from '../../lib/messages';
import { getAllNotes, onNotesChanged } from '../../lib/notes-store';
import { lockedKeys } from '../../lib/plan';
import { getSettings, onSettingsChanged, type Settings } from '../../lib/settings';

interface Mounted {
  host: HTMLElement;
  container: HTMLElement;
  key: string;
}

const MARKER_CLASS = 'event-notes-marker';
// Keys that should reach the notes box but never Calendar's keyboard shortcuts.
const ISOLATED_EVENTS = ['keydown', 'keyup', 'keypress'] as const;

export default defineContentScript({
  matches: ['https://calendar.google.com/*'],
  async main(ctx) {
    let settings: Settings = await getSettings();
    /** note key → locked on the free plan */
    let noteState = new Map<string, boolean>();
    const popups = new Map<Element, Mounted>();
    let page: (Mounted & { owner: Element }) | null = null;

    async function loadNotes() {
      const [notes, license] = await Promise.all([getAllNotes(), getLicense()]);
      const locked = lockedKeys(notes, isPro(license));
      noteState = new Map(notes.map((n) => [n.key, locked.has(n.key)]));
      schedule();
    }

    function mount(mp: Mountpoint, kind: 'popup' | 'page'): Mounted {
      const host = document.createElement('event-notes');
      host.style.display = 'block';
      host.style.margin = kind === 'popup' ? '8px 16px 12px' : '16px 0';
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = STYLES;
      const container = document.createElement('div');
      shadow.append(style, container);
      for (const type of ISOLATED_EVENTS) {
        host.addEventListener(type, (e) => {
          // Let Escape through so it still closes Calendar's popup.
          if ((e as KeyboardEvent).key !== 'Escape') e.stopPropagation();
        });
      }
      mp.parent.insertBefore(host, mp.before);
      render(<NoteEditor eventRef={mp.ref} getSnapshot={mp.snapshot} />, container);
      sendMessage({ type: 'current-event', event: { ref: mp.ref, snapshot: mp.snapshot(), at: Date.now() } });
      return { host, container, key: mp.ref.key };
    }

    function unmount(m: Mounted) {
      render(null, m.container); // runs the editor's cleanup, which flushes any pending save
      m.host.remove();
    }

    function syncPopups() {
      const found = settings.showInPopup ? findPopups() : [];
      const seen = new Set<Element>();
      for (const mp of found) {
        seen.add(mp.owner);
        const existing = popups.get(mp.owner);
        if (existing?.key === mp.ref.key && existing.host.isConnected) continue;
        if (existing) unmount(existing);
        popups.set(mp.owner, mount(mp, 'popup'));
      }
      for (const [owner, m] of popups) {
        if (!seen.has(owner)) {
          unmount(m);
          popups.delete(owner);
        }
      }
    }

    function syncPage() {
      const mp = settings.showOnEventPage ? findEventPage() : null;
      if (page && (!mp || page.key !== mp.ref.key || page.owner !== mp.owner || !page.host.isConnected)) {
        unmount(page);
        page = null;
      }
      if (mp && !page) page = { ...mount(mp, 'page'), owner: mp.owner };
    }

    function syncMarkers() {
      for (const { el, ref } of findChips()) {
        const locked = noteState.get(ref.key);
        const want = settings.showMarkers && locked !== undefined;
        let dot = el.querySelector<HTMLElement>(`:scope > .${MARKER_CLASS}`);
        if (!want) {
          dot?.remove();
          continue;
        }
        if (!dot) {
          dot = document.createElement('span');
          dot.className = MARKER_CLASS;
          dot.setAttribute('aria-hidden', 'true');
          Object.assign(dot.style, {
            position: 'absolute',
            top: '3px',
            right: '3px',
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#f2b84b',
            boxShadow: '0 0 0 1.5px #fff',
            zIndex: '1',
          });
          el.append(dot);
        }
        const title = locked ? 'Has a locked private note (free plan)' : 'Has a private note (Private Event Notes)';
        if (dot.title !== title) dot.title = title;
        dot.style.opacity = locked ? '0.5' : '1';
      }
    }

    let scheduled = false;
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        try {
          syncPopups();
          syncPage();
          syncMarkers();
        } catch (err) {
          console.warn('[Private Event Notes] could not update the page', err);
        }
      });
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const offs = [
      onNotesChanged(loadNotes),
      onLicenseChanged(loadNotes),
      onSettingsChanged((next) => {
        settings = next;
        schedule();
      }),
    ];
    await loadNotes();

    ctx.onInvalidated(() => {
      observer.disconnect();
      offs.forEach((off) => off());
      popups.forEach(unmount);
      if (page) unmount(page);
      document.querySelectorAll(`.${MARKER_CLASS}`).forEach((el) => el.remove());
    });
  },
});
