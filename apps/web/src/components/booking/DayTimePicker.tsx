'use client';

import {
  formatDateTime,
  formatDayOfMonth,
  formatMonthYear,
  formatTime,
  formatWeekday,
} from '@heach/i18n';
import { Icon } from '@heach/ui';
import { useId, useState } from 'react';
import { useI18n } from '../../lib/i18n-context';
import { DAY_PARTS, dayPart, daysFrom, indiaDay, indiaNoon, slotsByDay } from '../../lib/slots';

const WEEK = 7;

interface Props {
  /** Free times from the server only (AV-02); nothing here invents availability. */
  slots: readonly string[];
  selected: string;
  onSelect: (slot: string) => void;
  /** How many days the server was asked about, from today; arrows appear past one week. */
  horizon: number;
}

/**
 * Booking B and the desktop booking board (G07): a week of days with earlier and later arrows,
 * then the chosen day's free times grouped into morning, afternoon and evening. Days without a
 * free time are shown but cannot be chosen.
 */
export function DayTimePicker({ slots, selected, onSelect, horizon }: Readonly<Props>) {
  const { locale, t } = useI18n();
  const byDay = slotsByDay(slots);
  const today = indiaDay(new Date());
  const firstFree = [...byDay.keys()][0] ?? today;
  const span = Math.max(horizon, WEEK);
  // Start at today, unless the first free day falls outside that window (a device clock that
  // disagrees with the server's); then start at the first free day.
  const fromToday = daysFrom(today, span);
  const all = fromToday.includes(firstFree) ? fromToday : daysFrom(firstFree, span);
  const [day, setDay] = useState(selected ? indiaDay(selected) : firstFree);
  const [week, setWeek] = useState(Math.max(0, Math.floor(all.indexOf(day) / WEEK)));
  const shown = all.slice(week * WEEK, week * WEEK + WEEK);
  const monthId = useId();
  const times = byDay.get(day) ?? [];
  return (
    <div className="day-time">
      <div className="day-time__head">
        <p id={monthId} className="day-time__month">
          {formatMonthYear(indiaNoon(shown[0] ?? today), locale)}
        </p>
        {all.length > WEEK && (
          <div className="day-time__arrows">
            <button
              type="button"
              className="day-time__arrow"
              aria-label={t('book.earlierDays')}
              disabled={week === 0}
              onClick={() => {
                setWeek(week - 1);
              }}
            >
              <Icon name="chevron-left" size={20} />
            </button>
            <button
              type="button"
              className="day-time__arrow"
              aria-label={t('book.laterDays')}
              disabled={(week + 1) * WEEK >= all.length}
              onClick={() => {
                setWeek(week + 1);
              }}
            >
              <Icon name="chevron-right" size={20} />
            </button>
          </div>
        )}
      </div>
      <ul className="day-time__days" aria-labelledby={monthId}>
        {shown.map((entry) => {
          const noon = indiaNoon(entry);
          const free = byDay.has(entry);
          return (
            <li key={entry}>
              <button
                type="button"
                className="day-chip"
                aria-pressed={entry === day}
                disabled={!free}
                onClick={() => {
                  setDay(entry);
                }}
              >
                <span>{formatWeekday(noon, locale)}</span>
                <strong>{formatDayOfMonth(noon, locale)}</strong>
                {!free && <span className="heach-visually-hidden">{t('book.dayFull')}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <TimeGroups times={times} selected={selected} onSelect={onSelect} />
    </div>
  );
}

function TimeGroups({
  times,
  selected,
  onSelect,
}: Readonly<{ times: readonly string[]; selected: string; onSelect: (slot: string) => void }>) {
  const { locale, t } = useI18n();
  if (times.length === 0) return <p className="flow__muted">{t('book.noTimes')}</p>;
  return (
    <div className="day-time__parts">
      {DAY_PARTS.map((part) => {
        const inPart = times.filter((slot) => dayPart(slot) === part);
        if (inPart.length === 0) return null;
        return (
          <section key={part} className="day-time__part">
            <h3 className="day-time__part-title">{t(`book.parts.${part}`)}</h3>
            <ul className="time-grid">
              {inPart.map((slot) => (
                <li key={slot}>
                  <button
                    type="button"
                    className="time-chip"
                    aria-pressed={slot === selected}
                    aria-label={formatDateTime(new Date(slot), locale)}
                    onClick={() => {
                      onSelect(slot);
                    }}
                  >
                    {formatTime(new Date(slot), locale)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
