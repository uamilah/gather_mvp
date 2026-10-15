import { Check, CircleCheck, Clock3, MapPin, MessageSquareText, Pencil, Plus, RefreshCw, Trash2, UsersRound } from "lucide-react";
import { REQUIRED, TYPE_STYLE } from "@/demo/colors";
import { formatTime, parseIso } from "@/demo/dates";
import { clubById } from "@/demo/seed";
import type { Event } from "@/demo/types";

type Props = {
  event: Event;
  included: boolean;
  memberMode: boolean;
  flash: boolean;
  onToggle: (event: Event) => void;
  onOpen: (event: Event) => void;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
};

export function TypeChip({ type }: { type: Event["type"] }) {
  const style = TYPE_STYLE[type];
  return <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide" style={{ background: style.bg, color: style.fg }}>{style.label}</span>;
}

export function RequiredChip() {
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: REQUIRED.bg, color: REQUIRED.fg }}><CircleCheck size={11} strokeWidth={2.75} />Required</span>;
}

export function EventRow({ event, included, memberMode, flash, onToggle, onOpen, onEdit, onDelete }: Props) {
  const date = parseIso(event.date);
  const day = new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date);
  const weekday = new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
  const club = clubById(event.clubId);
  const lastChange = event.changes[event.changes.length - 1];

  return (
    <article
      className={`event-row group relative flex gap-3 border-b border-[#e9e4d9] py-3.5 pl-4 pr-3 sm:gap-4 sm:px-4 ${!included && memberMode ? "opacity-60" : ""} ${flash ? "flash-row" : ""}`}
      style={{ boxShadow: `inset 4px 0 0 ${event.mandatory ? REQUIRED.border : TYPE_STYLE[event.type].dot}` }}
      data-testid={`card-event-${event.id}`}
    >
      <button onClick={() => onOpen(event)} className="flex w-[50px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#f2efe6] py-2 text-center transition group-hover:bg-[#e9efe8] sm:w-[58px]" aria-label={`View ${event.title}`}>
        <span className="mono-font text-[10px] font-semibold uppercase tracking-wider text-[#727984]">{weekday}</span>
        <span className="display-font text-[22px] font-extrabold leading-6 text-[#252c41]">{day}</span>
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(event)}>
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <TypeChip type={event.type} />
          {event.mandatory && <RequiredChip />}
          {event.cancelled && <span className="rounded-full bg-[#252c41] px-2 py-0.5 text-[10px] font-bold text-white">Cancelled</span>}
          {!event.cancelled && lastChange && <span className="inline-flex items-center gap-1 rounded-full bg-[#fff3d6] px-2 py-0.5 text-[10px] font-bold text-[#8a5a00]"><RefreshCw size={10} />Updated{lastChange.via === "slack" ? " from Slack" : ""}</span>}
        </div>
        <h3 className={`truncate text-[15px] font-bold leading-5 text-[#252c41] ${event.cancelled ? "line-through decoration-2 opacity-60" : ""}`}>{event.title}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#777d86]">
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: club.color }}><UsersRound size={12} />{club.short}</span>
          <span className="inline-flex items-center gap-1"><Clock3 size={12} />{formatTime(event.startTime)}</span>
          {event.location && <span className="inline-flex min-w-0 items-center gap-1"><MapPin size={12} className="shrink-0" /><span className="truncate">{event.location}</span></span>}
          {event.source === "slack" && <span className="inline-flex items-center gap-1 text-[#92948f]"><MessageSquareText size={11} />#{club.channel}</span>}
        </div>
      </button>
      {memberMode ? (
        <button onClick={() => onToggle(event)} disabled={event.cancelled} className={`my-auto flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition disabled:invisible ${included ? "bg-[#e5efe9] text-[#34745b] hover:bg-[#d8e9df]" : "border border-[#d9d5ca] bg-[#fbfaf6] text-[#596170] hover:border-[#43876e] hover:text-[#34745b]"}`} aria-label={included ? "Remove from my calendar" : "Add to my calendar"}>
          {included ? <><Check size={14} /><span className="hidden sm:inline">Added</span></> : <><Plus size={14} /><span className="hidden sm:inline">Add</span></>}
        </button>
      ) : (
        <div className="my-auto flex shrink-0 items-center gap-1 md:opacity-0 md:transition group-hover:opacity-100">
          <button onClick={() => onEdit(event)} className="rounded-md p-2 text-[#767d86] hover:bg-[#efede6] hover:text-[#252c41]" title="Edit event" aria-label="Edit event"><Pencil size={15} /></button>
          <button onClick={() => onDelete(event)} className="rounded-md p-2 text-[#a25d54] hover:bg-[#f7e7e2]" title="Delete event" aria-label="Delete event"><Trash2 size={15} /></button>
        </div>
      )}
    </article>
  );
}
