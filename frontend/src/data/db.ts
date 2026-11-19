import { get, set, setMany } from 'idb-keyval';
import type { Dataset, Op } from '../domain/types';
import type { Lang } from '../i18n';

export type Theme = 'system' | 'light' | 'dark';

export interface Meta {
  schema?: number;
  token?: string;
  etag?: string;
  language?: Lang;
  theme?: Theme;
  persisted?: boolean;
}

export interface FailedOp {
  op: Op;
  error: string;
}

export const SCHEMA = 1;

export interface Stored {
  data: Dataset | undefined;
  outbox: Op[];
  failed: FailedOp[];
  meta: Meta;
}

export async function loadStored(): Promise<Stored> {
  const [data, outbox, failed, meta] = await Promise.all([
    get<Dataset>('data'),
    get<Op[]>('outbox'),
    get<FailedOp[]>('failed'),
    get<Meta>('meta'),
  ]);
  return { data, outbox: outbox ?? [], failed: failed ?? [], meta: migrate(meta ?? {}) };
}

// Schema 1 is the first layout, so an empty meta only needs its version stamped.
export function migrate(meta: Meta): Meta {
  return { ...meta, schema: SCHEMA };
}

export function saveQueues(data: Dataset, outbox: Op[]): Promise<void> {
  return setMany([
    ['data', data],
    ['outbox', outbox],
  ]);
}

export function saveFailed(failed: FailedOp[]): Promise<void> {
  return set('failed', failed);
}

export function saveMeta(meta: Meta): Promise<void> {
  return set('meta', meta);
}
