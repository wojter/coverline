import { lastSaved, outbox, syncState, type SyncState } from '../data/state';
import { t } from '../i18n';

const LABELS: Record<SyncState, string> = {
  'not-connected': 'sync.state.notConnected',
  idle: 'sync.state.idle',
  syncing: 'sync.state.syncing',
  offline: 'sync.state.offline',
  unauthorized: 'sync.state.unauthorized',
  error: 'sync.state.error',
};

export function SyncBadge() {
  const pending = outbox.value.length;
  let text: string;
  if (pending > 0) text = t('sync.queued', { count: pending });
  else if (syncState.value === 'idle' && lastSaved.value === 'synced') text = t('sync.synced');
  else if (syncState.value === 'idle' && lastSaved.value === 'local') text = t('sync.saved');
  else text = t(LABELS[syncState.value]);
  return <span class="badge badge-ghost whitespace-nowrap">{text}</span>;
}
