import { browser } from 'wxt/browser';

export interface Template {
  id: string;
  name: string;
  body: string;
}

const KEY = 'templates';

export const DEFAULT_TEMPLATES: Template[] = [
  { id: 'one-on-one', name: '1:1', body: 'Their updates:\n- \n\nMy updates:\n- \n\nFeedback:\n- \n\nFollow-ups:\n- ' },
  { id: 'meeting', name: 'Meeting', body: 'Context:\n\nDecisions:\n- \n\nAction items:\n- ' },
  { id: 'interview', name: 'Interview', body: 'Candidate:\nRole:\n\nStrengths:\n- \n\nConcerns:\n- \n\nRecommendation:' },
];

export async function getTemplates(): Promise<Template[]> {
  const res = await browser.storage.local.get(KEY);
  return (res[KEY] as Template[] | undefined) ?? DEFAULT_TEMPLATES;
}

export async function saveTemplates(templates: Template[]): Promise<void> {
  await browser.storage.local.set({ [KEY]: templates });
}
