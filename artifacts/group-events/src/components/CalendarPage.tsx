import { ArrowLeft, ArrowRight, Check, CircleCheck, Menu, Search, Settings } from "lucide-react";
import { REQUIRED, TYPE_STYLE } from "@/demo/colors";
import { CLUBS } from "@/demo/seed";
import { EVENT_TYPES, type Event } from "@/demo/types";
import { MonthGrid } from "./MonthGrid";

type Props = {
  events: Event[]; // already filtered to what's on the student's calendar
  hiddenClubs: Set<string>;
  monthOffset: number;
  flashId: string | null;
  onMonth: (offset: number) => void;
  onToggleClub: (id: string) => void;
  onOpen: (event: Event) => void;
};

// The student's own calendar web app, which Gather writes into.
export function CalendarPage({ events, hiddenClubs, monthOffset, flashId, onMonth, onToggleClub, onOpen }: Props) {
  const month = new Date();
  month.setDate(1);
  month.setMonth(month.getMonth() + monthOffset);
  const label = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(month);
  const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="flex h-full flex-col bg-white text-[#252c41]">
      <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-[#eceef0] px-4">
        <Menu size={20} className="text-[#5f6368]" />
        <span className="text-[19px] font-semibold tracking-tight text-[#3c4043]">Calendar</span>
        <button onClick={() => onMonth(0)} className="ml-8 rounded-full border border-[#dadce0] px-4 py-1.5 text-[13px] font-semibold text-[#3c4043] hover:bg-[#f6f8f9]">Today</button>
        <button onClick={() => onMonth(monthOffset - 1)} className="rounded-full p-1.5 text-[#5f6368] hover:bg-[#f1f3f4]" aria-label="Previous month"><ArrowLeft size={17} /></button>
        <button onClick={() => onMonth(monthOffset + 1)} className="rounded-full p-1.5 text-[#5f6368] hover:bg-[#f1f3f4]" aria-label="Next month"><ArrowRight size={17} /></button>
        <h1 className="text-[20px] font-semibold text-[#3c4043]">{label}</h1>
        <div className="ml-auto flex items-center gap-3 text-[#5f6368]"><Search size={18} /><Settings size={18} /><span className="rounded-md border border-[#dadce0] px-3 py-1 text-[13px] font-semibold text-[#3c4043]">Month</span></div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-[210px] shrink-0 overflow-y-auto border-r border-[#eceef0] px-4 py-4">
          <p className="mb-2 text-[12px] font-semibold text-[#3c4043]">Calendars from Gather</p>
          {CLUBS.map((club) => {
            const on = !hiddenClubs.has(club.id);
            return (
              <button key={club.id} onClick={() => onToggleClub(club.id)} className="flex w-full items-center gap-2.5 rounded-md py-1.5 text-left text-[13px] text-[#3c4043] hover:bg-[#f6f8f9]">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-2" style={{ borderColor: club.color, background: on ? club.color : "transparent" }}>{on && <Check size={11} strokeWidth={3.5} className="text-white" />}</span>
                <span className="truncate">{club.name}</span>
              </button>
            );
          })}
          <p className="mb-2 mt-6 text-[12px] font-semibold text-[#3c4043]">Event types</p>
          <div className="space-y-1.5">
            {EVENT_TYPES.map((type) => <p key={type} className="flex items-center gap-2 text-[12px] text-[#5f6368]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_STYLE[type].dot }} />{TYPE_STYLE[type].label}</p>)}
            <p className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: REQUIRED.fg }}><CircleCheck size={12} strokeWidth={2.75} />Required</p>
          </div>
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto">
          <MonthGrid tall month={month} events={events.filter((event) => event.date.startsWith(key))} flashId={flashId} onOpen={onOpen} />
        </div>
      </div>
    </div>
  );
}
