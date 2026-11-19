import { computed, signal } from '@preact/signals';
import { buildCycles } from '../domain/cycles';
import { seedDataset, type Dataset, type Op } from '../domain/types';
import type { FailedOp, Meta, Theme } from './db';

export type SyncState = 'not-connected' | 'idle' | 'syncing' | 'offline' | 'unauthorized' | 'error';

export const data = signal<Dataset>(seedDataset());
export const outbox = signal<Op[]>([]);
export const failed = signal<FailedOp[]>([]);
export const meta = signal<Meta>({});
export const syncState = signal<SyncState>('not-connected');
export const lastSaved = signal<'local' | 'synced' | null>(null);
export const device = signal<string | null>(null);
export const theme = signal<Theme>('system');
export const cycles = computed(() => buildCycles(data.value));
