import type { License } from '../lib/license';
import { sendMessage } from '../lib/messages';
import { FREE_NOTE_LIMIT } from '../lib/plan';

export const PRO_FEATURES = [
  `Unlimited notes (free keeps your ${FREE_NOTE_LIMIT} most recent)`,
  'Sync between browsers signed in to the same Chrome profile',
  'History from earlier occurrences of recurring meetings',
  'Search every note in the side panel',
  'Note templates (1:1, meeting, interview…)',
  'Export to Markdown for your notes app or knowledge base',
];

interface Props {
  pro: boolean;
  license?: License | null;
  /** Shorter copy for the side panel. */
  compact?: boolean;
  /** Optional lead-in, e.g. why this card is showing here. */
  lead?: string;
}

export function ProCard({ pro, license, compact, lead }: Props) {
  if (pro) {
    return (
      <div class="en-box en-pro-card">
        <p class="en-pro-title">
          Private Event Notes Pro <span class="en-pro">Active</span>
        </p>
        <p>Thank you for supporting a hobby developer. Every feature is unlocked, for good.</p>
        {!compact && (license?.email || license?.planLabel) && (
          <p class="en-message">
            {license.email && <>Purchased as {license.email}. </>}
            {license.planLabel && <>Coffee size: {license.planLabel}.</>}
          </p>
        )}
      </div>
    );
  }

  return (
    <div class="en-box en-pro-card">
      <p class="en-pro-title">Private Event Notes Pro</p>
      {lead && <p>{lead}</p>}
      <p>
        Private Event Notes is built in spare time by one hobby developer. Pro is a one-off “buy me a coffee”: pick any
        size from $1 and you get everything, forever. There's no subscription.
      </p>
      <ul class="en-feature-list">
        {(compact ? PRO_FEATURES.slice(0, 4) : PRO_FEATURES).map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div class="en-button-row">
        <button type="button" class="en-button en-primary" onClick={() => sendMessage({ type: 'open-upgrade' })}>
          ☕ Buy me a coffee · from $1
        </button>
        <button type="button" class="en-link" onClick={() => sendMessage({ type: 'open-login' })}>
          Already paid? Restore purchase
        </button>
      </div>
    </div>
  );
}
