import { applyOp } from './apply';
import { loadStored, saveFailed, saveMeta, saveQueues, type Meta, type Theme } from './db';
import { cancelRetry, fetchDevice, requestSync, splitToken } from './sync';
import { data, device, failed, lastSaved, meta, outbox, syncState, theme } from './state';
import { detectLanguage, setLanguage, type Lang } from '../i18n';
import type { Op } from '../domain/types';

export { cycles, data, device, failed, lastSaved, outbox, syncState, theme } from './state';

export interface RejectedOp {
  op: Op;
  error: string;
}

let listening = false;

export async function init(): Promise<void> {
  const stored = await loadStored();
  if (stored.data) data.value = stored.data;
  outbox.value = stored.outbox;
  failed.value = stored.failed;
  meta.value = stored.meta;
  theme.value = stored.meta.theme ?? 'system';
  setLanguage(stored.meta.language ?? detectLanguage(browserLanguage()));
  await requestPersistence();
  listen();
  if (meta.value.token) {
    syncState.value = 'idle';
    void refreshDevice();
    void requestSync();
  } else {
    syncState.value = 'not-connected';
  }
}

function browserLanguage(): string {
  return typeof navigator === 'undefined' ? 'en' : navigator.language;
}

async function requestPersistence(): Promise<void> {
  if (meta.value.persisted !== undefined || typeof navigator === 'undefined') return;
  const persisted = (await navigator.storage?.persist?.()) ?? false;
  await updateMeta({ persisted });
}

// The online and visibility triggers are attached once.
function listen(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('online', () => void requestSync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void requestSync();
  });
}

async function updateMeta(change: Partial<Meta>): Promise<void> {
  meta.value = { ...meta.value, ...change };
  await saveMeta(meta.value);
}

async function persistQueues(): Promise<void> {
  await saveQueues(data.value, outbox.value);
}

// Applies each op locally. Ops the local rules reject are not queued and are returned.
export async function save(ops: Op[]): Promise<RejectedOp[]> {
  let current = data.value;
  const accepted: Op[] = [];
  const rejected: RejectedOp[] = [];
  for (const op of ops) {
    const result = applyOp(current, op);
    if (result.rejected) {
      rejected.push({ op, error: result.rejected });
    } else {
      current = result.data;
      accepted.push(op);
    }
  }
  data.value = current;
  if (accepted.length > 0) {
    outbox.value = [...outbox.value, ...accepted];
    lastSaved.value = 'local';
    await persistQueues();
    void requestSync();
  }
  return rejected;
}

// Returns 'ok', 'invalid' for a malformed token, or 'rejected' when the server refuses it.
export async function connect(token: string): Promise<'ok' | 'invalid' | 'rejected'> {
  if (!splitToken(token)) return 'invalid';
  await updateMeta({ token, etag: undefined });
  const label = await fetchDevice(token);
  if (label === null) {
    await disconnect();
    return 'rejected';
  }
  device.value = label;
  syncState.value = 'idle';
  void requestSync(true);
  return 'ok';
}

export async function disconnect(): Promise<void> {
  cancelRetry();
  await updateMeta({ token: undefined, etag: undefined });
  device.value = null;
  syncState.value = 'not-connected';
}

async function refreshDevice(): Promise<void> {
  const token = meta.value.token;
  if (!token) return;
  try {
    device.value = await fetchDevice(token);
  } catch {
    device.value = null;
  }
}

export async function retryFailed(index: number): Promise<void> {
  const item = failed.value[index];
  if (!item) return;
  failed.value = failed.value.filter((_, i) => i !== index);
  outbox.value = [...outbox.value, item.op];
  await Promise.all([saveFailed(failed.value), persistQueues()]);
  void requestSync(true);
}

export async function discardFailed(index: number): Promise<void> {
  failed.value = failed.value.filter((_, i) => i !== index);
  await saveFailed(failed.value);
}

export function syncNow(): Promise<void> {
  return requestSync(true);
}

export async function changeLanguage(next: Lang): Promise<void> {
  setLanguage(next);
  await updateMeta({ language: next });
}

export async function changeTheme(next: Theme): Promise<void> {
  theme.value = next;
  await updateMeta({ theme: next });
}
