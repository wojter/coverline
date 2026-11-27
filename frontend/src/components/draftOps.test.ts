import { describe, expect, it } from 'vitest';
import { EMPTY, fieldOps, isEmpty, tempOps, withoutSent, type Draft } from './draftOps';

const DATE = '2026-11-27';

describe('tempOps', () => {
  it('saves a typed reading as integer hundredths', () => {
    expect(tempOps({ text: '3645' }, undefined, DATE, '1')).toEqual({ ops: [{ entity: 'temp', key: `${DATE}/1`, set: { value: 3645 } }], invalid: false });
  });

  it('flags invalid text and sends nothing', () => {
    expect(tempOps({ text: '3x' }, undefined, DATE, '1')).toEqual({ ops: [], invalid: true });
  });

  it('sends nothing when the text matches the stored reading', () => {
    expect(tempOps({ text: '36,45' }, { value: 3645, excluded: false } as never, DATE, '1').ops).toEqual([]);
  });

  it('clears a stored reading when the text is emptied', () => {
    const { ops } = tempOps({ text: '' }, { value: 3645, excluded: false } as never, DATE, '2');
    expect(ops).toHaveLength(1);
    expect(ops[0].key).toBe(`${DATE}/2`);
  });
});

describe('fieldOps', () => {
  it('sends touched fields only, cleared ones as null', () => {
    expect(fieldOps({ mucus_sensation: 'moist', bleeding: null }, DATE)).toEqual([{ entity: 'day', key: DATE, set: { mucus_sensation: 'moist', bleeding: null } }]);
    expect(fieldOps({}, DATE)).toEqual([]);
  });
});

describe('withoutSent', () => {
  it('drops saved entries and keeps unsent ones', () => {
    const temp = { text: '3x' };
    const current: Draft = { fields: { mucus_sensation: 'dry' }, temps: { '1': temp }, marks: { mucus: 'P' } };
    const sent: Draft = { fields: { mucus_sensation: 'dry' }, temps: {}, marks: { mucus: 'P' } };
    expect(withoutSent(current, sent)).toEqual({ fields: {}, temps: { '1': temp }, marks: {} });
  });

  it('keeps an entry that changed again while the save ran', () => {
    const current: Draft = { ...EMPTY, fields: { notes: 'longer text' } };
    const sent: Draft = { ...EMPTY, fields: { notes: 'longer' } };
    expect(withoutSent(current, sent).fields).toEqual({ notes: 'longer text' });
    expect(isEmpty(withoutSent(current, current))).toBe(true);
  });
});
