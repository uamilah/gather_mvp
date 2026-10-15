import { CircleCheck } from "lucide-react";
import { REQUIRED, TYPE_STYLE } from "@/demo/colors";
import { formatTime, iso } from "@/demo/dates";
import type { Event } from "@/demo/types";

type Props = {
  month: Date; // any day in the month to show
  events: Event[];
  flashId: string | null;
  onOpen: (event: Event) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthGrid({ month, events, flashId, onOpen }: Props) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  // Drop a trailing week that is entirely next month.
  const visible = days[35].getMonth() !== month.getMonth() ? days.slice(0, 35) : days;
  const todayKey = iso(new Date());
  const byDay = events.reduce<Record<string, Event[]>>((acc, event) => {
    (acc[event.date] ??= []).push(event);
    return acc;
  }, {});

  return (
    <div className="p-2 sm:p-3">
      <div className="grid grid-cols-7 pb-1">
        {WEEKDAYS.map((day) => <div key={day} className="mono-font px-1 text-center text-[9px] font-semibold uppercase tracking-[.12em] text-[#94958f] sm:text-left sm:text-[10px]">{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[#e9e4d9] bg-[#e9e4d9]">
        {visible.map((d) => {
          const key = iso(d);
          const inMonth = d.getMonth() === month.getMonth();
          const dayEvents = (byDay[key] ?? []).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
          return (
            <div key={key} className={`min-h-[64px] p-1 sm:min-h-[86px] sm:p-1.5 ${inMonth ? "bg-[#fbfaf6]" : "bg-[#f4f1e9]"}`}>
              <div className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${key === todayKey ? "bg-[#252c41] text-white" : inMonth ? "text-[#4a515d]" : "text-[#b5b3aa]"}`}>{d.getDate()}</div>
              {/* Phones: coloured dots. Larger screens: labelled chips. */}
              <div className="flex flex-wrap gap-0.5 sm:hidden">
                {dayEvents.map((event) => (
                  <button key={event.id} onClick={() => onOpen(event)} aria-label={event.title} className={`h-2 w-2 rounded-full ${event.cancelled ? "opacity-30" : ""} ${event.mandatory ? "ring-2 ring-offset-1" : ""}`} style={{ background: TYPE_STYLE[event.type].dot, ["--tw-ring-color" as string]: REQUIRED.border }} />
                ))}
              </div>
              <div className="hidden space-y-0.5 sm:block">
                {dayEvents.slice(0, 3).map((event) => {
                  const style = TYPE_STYLE[event.type];
                  return (
                    <button
                      key={event.id}
                      onClick={() => onOpen(event)}
                      className={`flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[10.5px] font-semibold leading-4 transition hover:brightness-95 ${event.cancelled ? "line-through opacity-50" : ""} ${flashId === event.id ? "flash-chip" : ""}`}
                      style={{ background: style.bg, color: style.fg, boxShadow: event.mandatory ? `inset 3px 0 0 ${REQUIRED.border}` : undefined }}
                      title={`${event.title} · ${formatTime(event.startTime)}`}
                    >
                      {event.mandatory && <CircleCheck size={11} strokeWidth={2.75} className="shrink-0" style={{ color: REQUIRED.fg }} />}
                      <span className="truncate">{event.title}</span>
                    </button>
                  );
                })}
                {dayEvents.length > 3 && <p className="px-1 text-[10px] font-semibold text-[#8a8e90]">+{dayEvents.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
