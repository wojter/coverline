import { applyOp } from './apply';
import { saveFailed, saveMeta, saveQueues, type FailedOp } from './db';
import { data, failed, lastSaved, meta, outbox, syncState } from './state';
import type { Dataset, Op } from '../domain/types';

const RETRY_FIRST_MS = 2_000;
const RETRY_MAX_MS = 300_000;

// The server refuses the token (401/403, or a redirect to the Access login). Not retried.
class AuthError extends Error {}
// The request never got an answer. Retried with backoff, shown as offline.
class NetworkError extends Error {}
// The server answered with an error status. Retried with backoff.
class ServerError extends Error {}

let inFlight: Promise<void> | null = null;
let rerunRequested = false;
let retryDelay = RETRY_FIRST_MS;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

export function splitToken(token: string): { id: string; secret: string } | null {
  const index = token.indexOf(':');
  if (index <= 0 || index === token.length - 1) return null;
  return { id: token.slice(0, index), secret: token.slice(index + 1) };
}

// Only one sync runs at a time. A request made meanwhile runs once more afterwards.
export function requestSync(manual = false): Promise<void> {
  if (!meta.value.token) {
    syncState.value = 'not-connected';
    return Promise.resolve();
  }
  if (syncState.value === 'unauthorized' && !manual) return Promise.resolve();
  if (inFlight) {
    rerunRequested = true;
    return inFlight;
  }
  inFlight = runSyncLoop().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSyncLoop(): Promise<void> {
  let succeeded = true;
  do {
    rerunRequested = false;
    succeeded = await syncOnce();
  } while (rerunRequested && succeeded);
}

export function cancelRetry(): void {
  clearTimeout(retryTimer);
  retryTimer = undefined;
  retryDelay = RETRY_FIRST_MS;
}

async function syncOnce(): Promise<boolean> {
  const token = meta.value.token;
  if (!token) return false;
  const sent = outbox.value;
  syncState.value = 'syncing';
  try {
    if (sent.length > 0) await pushOps(token, sent);
    await pullData(token);
    cancelRetry();
    syncState.value = 'idle';
    lastSaved.value = outbox.value.length === 0 ? 'synced' : 'local';
    return true;
  } catch (error) {
    return handleFailure(error);
  }
}

// The snapshot is `sent`. Ops saved during the request are appended after it and stay queued.
async function pushOps(token: string, sent: Op[]): Promise<void> {
  const response = await request(token, '/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ops: sent }),
  });
  const body = (await response.json()) as { rejected: { index: number; error: string }[] };
  outbox.value = outbox.value.slice(sent.length);
  const rejected: FailedOp[] = body.rejected.map((r) => ({ op: sent[r.index], error: r.error }));
  if (rejected.length > 0) failed.value = [...failed.value, ...rejected];
  await saveQueues(data.value, outbox.value);
  if (rejected.length > 0) await saveFailed(failed.value);
}

async function pullData(token: string): Promise<void> {
  const etag = meta.value.etag;
  const headers: Record<string, string> = etag ? { 'if-none-match': etag } : {};
  const response = await request(token, '/api/data', { method: 'GET', headers });
  if (response.status === 304) return;
  const server = (await response.json()) as Dataset;
  data.value = outbox.value.reduce<Dataset>((current, op) => applyOp(current, op).data, server);
  meta.value = { ...meta.value, etag: response.headers.get('etag') ?? undefined };
  await Promise.all([saveQueues(data.value, outbox.value), saveMeta(meta.value)]);
}

async function request(token: string, path: string, init: RequestInit): Promise<Response> {
  const credentials = splitToken(token);
  if (!credentials) throw new AuthError('malformed token');
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      redirect: 'manual',
      headers: {
        ...(init.headers as Record<string, string>),
        'CF-Access-Client-Id': credentials.id,
        'CF-Access-Client-Secret': credentials.secret,
      },
    });
  } catch {
    throw new NetworkError('offline');
  }
  if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
    throw new AuthError('refused');
  }
  if (response.status !== 304 && !response.ok) throw new ServerError(`status ${response.status}`);
  return response;
}

function handleFailure(error: unknown): boolean {
  if (error instanceof AuthError) {
    syncState.value = 'unauthorized';
    return false;
  }
  syncState.value = error instanceof NetworkError ? 'offline' : 'error';
  scheduleRetry();
  return false;
}

function scheduleRetry(): void {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void requestSync(), retryDelay);
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
}

// Returns the device label, or null when the server refuses the token.
export async function fetchExport(token: string): Promise<string> {
  const response = await request(token, '/api/export.json', { method: 'GET', headers: {} });
  return response.text();
}

export async function fetchDevice(token: string): Promise<string | null> {
  try {
    const response = await request(token, '/api/me', { method: 'GET', headers: {} });
    const body = (await response.json()) as { device: string };
    return body.device;
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}
