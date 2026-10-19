import { useEffect, useMemo, useState } from 'preact/hooks';
import { getLicense, isPro, onLicenseChanged, type License } from '../lib/license';
import { getAllNotes, isSeriesNote, onNotesChanged, type Note } from '../lib/notes-store';
import { FREE_NOTE_LIMIT, lockedKeys } from '../lib/plan';
import { getSettings, onSettingsChanged, type Settings } from '../lib/settings';

export interface PlanState {
  ready: boolean;
  license: License | null;
  settings: Settings | null;
  notes: Note[];
  pro: boolean;
  locked: Set<string>;
  usedFreeSlots: number;
}

/** Everything a view needs to decide what's free, Pro or locked; live-updating. */
export function usePlanState(): PlanState {
  const [license, setLicense] = useState<License | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);

  useEffect(() => {
    getLicense().then(setLicense);
    getSettings().then(setSettings);
    const loadNotes = () => getAllNotes().then(setNotes);
    loadNotes();
    const offs = [onLicenseChanged(setLicense), onSettingsChanged(setSettings), onNotesChanged(loadNotes)];
    return () => offs.forEach((off) => off());
  }, []);

  return useMemo(() => {
    const pro = isPro(license);
    const all = notes ?? [];
    return {
      ready: !!license && !!settings && !!notes,
      license,
      settings,
      notes: all,
      pro,
      locked: lockedKeys(all, pro),
      usedFreeSlots: Math.min(all.filter((n) => !isSeriesNote(n)).length, FREE_NOTE_LIMIT),
    };
  }, [license, settings, notes]);
}
