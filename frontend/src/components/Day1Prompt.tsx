import { useState } from 'preact/hooks';
import { Modal } from './Modal';
import { type Day1Request } from './day1';
import { save } from '../data/store';
import { data, cycles } from '../data/state';
import { addDays } from '../domain/dates';
import { moveStartOps, removeStartOps, startCycleOps, type MoveError } from '../domain/cycles';
import { formatDate, t } from '../i18n';

export function Day1Prompt({ request, onDone }: { request: Day1Request; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(addDays(request.date, 1));
  const title = request.kind === 'ask' ? t('day1.askTitle') : t('day1.uncheckTitle');
  const cycle = cycles.value.find((item) => item.id === request.cycleId);

  async function apply(ops: ReturnType<typeof moveStartOps>) {
    if (!Array.isArray(ops)) return setError(t(`day1.${(ops as { error: MoveError }).error === 'neighbour' ? 'neighbour' : 'afterEnd'}`));
    await save(ops);
    onDone();
  }

  return (
    <Modal title={title} onClose={onDone}>
      {request.kind === 'ask' ? (
        <>
          <p class="text-sm">{t('day1.askBody', { start: cycle ? formatDate(cycle.start, 'short') : '' })}</p>
          <button type="button" class="btn btn-primary min-h-11 rounded-full" onClick={() => apply(moveStartOps(data.value, request.cycleId, request.date))}>
            {t('day1.moveHere')}
          </button>
          <button
            type="button"
            class="btn btn-outline min-h-11 rounded-full"
            onClick={async () => {
              await save(startCycleOps(data.value, request.date, crypto.randomUUID()));
              onDone();
            }}
          >
            {t('day1.newCycle')}
          </button>
        </>
      ) : (
        <>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-semibold">{t('day1.moveToOther')}</span>
            <input type="date" class="input w-full text-base" value={newDate} onInput={(event) => setNewDate((event.target as HTMLInputElement).value)} />
          </label>
          <button type="button" class="btn btn-outline min-h-11 rounded-full" onClick={() => apply(moveStartOps(data.value, request.cycleId, newDate))}>
            {t('day1.apply')}
          </button>
          <button type="button" class="btn btn-soft btn-error min-h-11 rounded-full" onClick={async () => { await save(removeStartOps(data.value, request.cycleId)); onDone(); }}>
            {t('day1.removeStart')}
          </button>
        </>
      )}
      {error && <p role="alert" class="text-sm text-error">{error}</p>}
    </Modal>
  );
}
