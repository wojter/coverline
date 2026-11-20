import { useState } from 'preact/hooks';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-preact';
import { DayForm } from '../components/DayForm';
import { Day1Prompt } from '../components/Day1Prompt';
import { SaveBar } from '../components/SaveBar';
import { isCycleStart, requestDay1, type Day1Request } from '../components/day1';
import { useDayDraft } from '../components/useDayDraft';
import { cycles } from '../data/state';
import { cycleAt } from '../domain/cycles';
import { addDays, isDate } from '../domain/dates';
import { formatDate, t } from '../i18n';

export default function Entry({ date }: { date: string }) {
  if (!isDate(date)) return <p class="text-error">{t('app.notFound')}</p>;
  return <EntryForm key={date} date={date} />;
}

function EntryForm({ date }: { date: string }) {
  const draft = useDayDraft(date);
  const [request, setRequest] = useState<Day1Request | null>(null);
  const hit = cycleAt(cycles.value, date);
  const title = formatDate(date, 'long');
  const subtitle = hit ? t('entry.cycleDay', { day: hit.day }) : t('entry.noCycle');

  function toggleDay1() {
    const next = requestDay1(date);
    if (next) setRequest(next);
  }

  return (
    <div class="flex flex-col gap-4 pb-44 lg:pb-28">
      <nav class="flex items-center justify-between gap-2">
        <a href="/" class="btn btn-ghost btn-circle min-h-11 min-w-11" aria-label={t('entry.back')}>
          <ArrowLeft size={20} aria-hidden="true" />
        </a>
        <div class="text-center">
          <h1 class="text-lg font-semibold">{title}</h1>
          <p class="text-xs opacity-70">{subtitle}</p>
        </div>
        <div class="flex gap-1">
          <a href={`/entry/${addDays(date, -1)}`} class="btn btn-ghost btn-circle min-h-11 min-w-11" aria-label={t('entry.previous')}>
            <ChevronLeft size={20} aria-hidden="true" />
          </a>
          <a href={`/entry/${addDays(date, 1)}`} class="btn btn-ghost btn-circle min-h-11 min-w-11" aria-label={t('entry.next')}>
            <ChevronRight size={20} aria-hidden="true" />
          </a>
        </div>
      </nav>
      <DayForm draft={draft} variant="full" day1={{ checked: isCycleStart(date), onToggle: toggleDay1 }} />
      <SaveBar onSave={() => void draft.save()} status={draft.status} disabled={!draft.dirty} />
      {request && <Day1Prompt request={request} onDone={() => setRequest(null)} />}
    </div>
  );
}
