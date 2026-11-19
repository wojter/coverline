import { outbox, syncState, type SyncState } from '../data/state';
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
  const text = pending > 0 ? t('sync.queued', { count: pending }) : t(LABELS[syncState.value]);
  return <span class="badge badge-ghost whitespace-nowrap">{text}</span>;
}
