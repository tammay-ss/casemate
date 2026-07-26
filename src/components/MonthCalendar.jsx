import { useMemo, useState } from "react";
import "./MonthCalendar.css";
import { isYmdInMonth, parseYmd, toYmd } from "../schedule.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isCalendarItem(item) {
  return item.kind === "hearing" || item.kind === "meeting" || item.kind === "task";
}

function kindLabel(kind) {
  if (kind === "hearing") return "Hearing";
  if (kind === "meeting") return "Meeting";
  return "Other";
}

function formatListDay(ymd) {
  return parseYmd(ymd).toLocaleDateString("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatMonthYear(d) {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function getMonthCells(monthStart) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const leadingDays = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((leadingDays + last.getDate()) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - leadingDays + 1;
    const date = new Date(year, month, dayNumber);
    return {
      date,
      ymd: toYmd(date),
      inMonth: date.getMonth() === month,
      day: date.getDate(),
    };
  });
}

function getEventKinds(items, ymd) {
  return new Set(
    items.filter((i) => isCalendarItem(i) && i.date === ymd).map((i) => i.kind)
  );
}

export default function MonthCalendar({ items }) {
  const [activeMonth, setActiveMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const monthItems = useMemo(() => {
    return items
      .filter((i) => isCalendarItem(i) && isYmdInMonth(i.date, activeMonth))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  }, [items, activeMonth]);

  const grouped = useMemo(() => {
    const out = [];
    for (const entry of monthItems) {
      const last = out[out.length - 1];
      if (last && last.date === entry.date) {
        last.entries.push(entry);
      } else {
        out.push({ date: entry.date, entries: [entry] });
      }
    }
    return out;
  }, [monthItems]);

  const monthCells = useMemo(() => getMonthCells(activeMonth), [activeMonth]);

  const moveMonth = (offset) => {
    setActiveMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1)
    );
  };

  return (
    <section
      className="month-calendar"
      id="calendar-panel"
      aria-labelledby="calendar-heading"
    >
      <div className="month-calendar__header">
        <div>
          <h2 id="calendar-heading" className="month-calendar__title">
            Calendar
          </h2>
          <p className="month-calendar__subtitle">
            Month view. Marked days have saved tasks, hearings, or meetings.
          </p>
        </div>
        <div className="month-calendar__nav" aria-label="Calendar navigation">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">
            Prev
          </button>
          <span>{formatMonthYear(activeMonth)}</span>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">
            Next
          </button>
        </div>
      </div>

      <div className="month-grid" role="grid" aria-label={formatMonthYear(activeMonth)}>
        {WEEKDAYS.map((day) => (
          <div key={day} className="month-grid__weekday" role="columnheader">
            {day}
          </div>
        ))}
        {monthCells.map((cell) => {
          const kinds = getEventKinds(items, cell.ymd);
          const hasHearing = kinds.has("hearing");
          const hasMeeting = kinds.has("meeting");
          const hasTask = kinds.has("task");
          const isToday = cell.ymd === toYmd(new Date());
          return (
            <div
              key={cell.ymd}
              className={`month-grid__cell${cell.inMonth ? "" : " month-grid__cell--muted"}${
                isToday ? " month-grid__cell--today" : ""
              }`}
              role="gridcell"
            >
              <span>{cell.day}</span>
              {(hasHearing || hasMeeting || hasTask) && (
                <span
                  className={`month-grid__marker${
                    hasHearing ? " month-grid__marker--hearing" : ""
                  }${hasMeeting ? " month-grid__marker--meeting" : ""}`}
                  aria-label="Scheduled task, hearing, or meeting"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="month-calendar__list" role="list">
        {grouped.length === 0 ? (
          <p className="month-calendar__empty">
            No tasks scheduled in this month.
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.date} className="month-cal-day" role="listitem">
              <h3 className="month-cal-day__label">{formatListDay(group.date)}</h3>
              <ul className="month-cal-day__items">
                {group.entries.map((ev) => (
                  <li key={ev.id} className="month-cal-item">
                    <span
                      className={`month-cal-item__badge month-cal-item__badge--${ev.kind}`}
                    >
                      {kindLabel(ev.kind)}
                    </span>
                    <span className="month-cal-item__time">{ev.time}</span>
                    <span className="month-cal-item__title">{ev.title}</span>
                    <span className="month-cal-item__client">
                      {ev.clientName} - {ev.caseName}
                    </span>
                    {ev.note ? (
                      <span className="month-cal-item__note">{ev.note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
