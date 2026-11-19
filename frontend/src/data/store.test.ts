import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedDataset, type Op } from '../domain/types';

const { idb } = vi.hoisted(() => ({ idb: new Map<string, unknown>() }));

vi.mock('idb-keyval', () => ({
  get: async (key: string) => idb.get(key),
  set: async (key: string, value: unknown) => {
    idb.set(key, value);
  },
  setMany: async (entries: [string, unknown][]) => {
    for (const [key, value] of entries) idb.set(key, value);
  },
}));

type Store = typeof import('./store');

const dayOp: Op = { entity: 'day', key: '2026-11-18', set: { notes: 'a' } };
const otherOp: Op = { entity: 'day', key: '2026-11-18', set: { notes: 'b' } };

// Controls what the fake server answers. Reset before each test.
let server: {
  offline: boolean;
  status: number;
  rejected: { index: number; error: string }[];
  gate?: Promise<void>;
};

let fetchMock: ReturnType<typeof vi.fn>;
let store: Store;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

async function route(url: string, init: RequestInit): Promise<Response> {
  const headers = init.headers as Record<string, string>;
  if (url === '/api/me') return json({ device: 'ios' });
  if (server.offline) throw new TypeError('network down');
  if (url === '/api/sync') {
    if (server.gate) await server.gate;
    server.gate = undefined;
    if (server.status !== 200) return new Response(null, { status: server.status });
    return json({ version: 'v2', rejected: server.rejected });
  }
  if (headers['if-none-match'] === '"v1"') return new Response(null, { status: 304 });
  return json({ ...seedDataset(), version: 'v1' }, 200, { etag: '"v1"' });
}

function postedOps(): Op[][] {
  return fetchMock.mock.calls
    .filter(([url, init]) => url === '/api/sync' && init?.method === 'POST')
    .map(([, init]) => (JSON.parse(init.body as string) as { ops: Op[] }).ops);
}

beforeEach(async () => {
  vi.useFakeTimers();
  idb.clear();
  server = { offline: false, status: 200, rejected: [] };
  fetchMock = vi.fn(route);
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  store = await import('./store');
  await store.init();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function connected(): Promise<void> {
  expect(await store.connect('client-id.access:secret')).toBe('ok');
  await store.syncNow();
}

describe('connecting', () => {
  it('refuses a token without a colon and sends no request', async () => {
    expect(await store.connect('nocolon')).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.syncState.value).toBe('not-connected');
  });

  it('sends the token as Access service headers and stores the device label', async () => {
    await connected();
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/me') ?? [];
    expect(init.headers).toMatchObject({
      'CF-Access-Client-Id': 'client-id.access',
      'CF-Access-Client-Secret': 'secret',
    });
    expect(init.redirect).toBe('manual');
    expect(store.device.value).toBe('ios');
  });
});

describe('saving', () => {
  it('drops ops the local rules reject and reports them', async () => {
    const rejected = await store.save([{ entity: 'day', key: '2026-11-18', set: { bleeding: 'heavy_flow' } }]);
    expect(rejected).toHaveLength(1);
    expect(store.outbox.value).toEqual([]);
  });

  it('applies valid ops locally before any sync', async () => {
    await store.save([dayOp]);
    expect(store.data.value.days['2026-11-18']?.notes).toBe('a');
    expect(store.lastSaved.value).toBe('local');
  });
});

describe('sync', () => {
  it('syncs an offline save once the connection returns', async () => {
    await connected();
    server.offline = true;
    await store.save([dayOp]);
    await store.syncNow();
    expect(store.syncState.value).toBe('offline');
    expect(store.outbox.value).toHaveLength(1);

    server.offline = false;
    await store.syncNow();
    expect(postedOps().at(-1)).toEqual([dayOp]);
    expect(store.outbox.value).toEqual([]);
    expect(store.syncState.value).toBe('idle');
    expect(store.lastSaved.value).toBe('synced');
  });

  it('moves rejected ops to failed and lets the user retry them', async () => {
    await connected();
    server.rejected = [{ index: 0, error: 'notes: invalid' }];
    await store.save([dayOp]);
    await store.syncNow();
    expect(store.failed.value).toEqual([{ op: dayOp, error: 'notes: invalid' }]);
    expect(store.outbox.value).toEqual([]);

    server.rejected = [];
    await store.retryFailed(0);
    await store.syncNow();
    expect(store.failed.value).toEqual([]);
    expect(postedOps().at(-1)).toEqual([dayOp]);
  });

  it('keeps the outbox on 401 and does not retry on its own', async () => {
    await connected();
    server.status = 401;
    await store.save([dayOp]);
    await store.syncNow();
    expect(store.syncState.value).toBe('unauthorized');
    expect(store.outbox.value).toEqual([dayOp]);

    const calls = fetchMock.mock.calls.length;
    await store.save([otherOp]);
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(store.outbox.value).toEqual([dayOp, otherOp]);

    await store.syncNow();
    expect(fetchMock.mock.calls.length).toBe(calls + 1);
    expect(store.syncState.value).toBe('unauthorized');
  });

  it('keeps data on 304', async () => {
    await connected();
    const before = store.data.value;
    await store.syncNow();
    const [, init] = fetchMock.mock.calls.filter(([url]) => url === '/api/data').at(-1) ?? [];
    expect(init.headers).toMatchObject({ 'if-none-match': '"v1"' });
    expect(store.data.value).toEqual(before);
    expect(store.syncState.value).toBe('idle');
  });

  it('keeps an op saved during an in-flight push and sends it next', async () => {
    await connected();
    let release = () => {};
    server.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = store.save([dayOp]);
    await first;
    await store.save([otherOp]);
    expect(store.outbox.value).toEqual([dayOp, otherOp]);

    release();
    await store.syncNow();
    expect(postedOps()).toEqual([[dayOp], [otherOp]]);
    expect(store.outbox.value).toEqual([]);
    expect(store.data.value.days['2026-11-18']?.notes).toBe('b');
  });
});
