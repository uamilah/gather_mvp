import type { Event } from "@workspace/api-client-react";
import { ArrowUpRight, Calendar, Check, Clock3, MapPin, MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";

type Props = {
  event: Event;
  included: boolean;
  memberMode: boolean;
  onToggle: (event: Event) => void;
  onOpen: (event: Event) => void;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
};

const colorMap: Record<string, string> = {
  meeting: "bg-[#e3eee8] text-[#35745c]",
  social: "bg-[#f7e7dd] text-[#a85c3e]",
  service: "bg-[#e1edf1] text-[#39778a]",
  deadline: "bg-[#f4e8c9] text-[#8c6d21]",
  fundraiser: "bg-[#ece5f1] text-[#70588b]",
  other: "bg-[#ecebe5] text-[#676c72]",
};

export function EventRow({ event, included, memberMode, onToggle, onOpen, onEdit, onDelete }: Props) {
  const date = new Date(`${event.date}T00:00:00`);
  const day = new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date);
  const weekday = new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
  const month = new Intl.DateTimeFormat("en", { month: "short" }).format(date);
  const time = event.startTime ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(`2000-01-01T${event.startTime}`)) : "Time TBA";

  return (
    <article className={`event-row group flex gap-4 border-b border-[#e9e4d9] px-4 py-4 ${!included && memberMode ? "opacity-60" : ""}`} data-testid={`card-event-${event.id}`}>
      <button onClick={() => onOpen(event)} className="flex w-[58px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#f2efe6] py-2 text-center transition group-hover:bg-[#e9efe8]" aria-label={`View ${event.title}`} data-testid={`button-open-event-${event.id}`}>
        <span className="mono-font text-[10px] font-semibold uppercase tracking-wider text-[#727984]">{weekday}</span><span className="display-font text-[22px] font-extrabold leading-6 text-[#252c41]">{day}</span><span className="text-[10px] font-semibold uppercase text-[#727984]">{month}</span>
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(event)} data-testid={`button-event-detail-${event.id}`}>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize tracking-wide ${colorMap[event.type] ?? colorMap.other}`}>{event.type}</span>
          {event.mandatory && <span className="rounded-full bg-[#f7e4df] px-2 py-0.5 text-[10px] font-bold text-[#a14c42]">Required</span>}
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#92948f]">{event.source === "slack" ? <><MessageSquareText size={11} /> Slack{event.sourceChannelName ? ` · #${event.sourceChannelName}` : ""}</> : <><Calendar size={11} /> Organizer</>}</span>
        </div>
        <h3 className="truncate text-[15px] font-bold leading-5 text-[#252c41]">{event.title}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#777d86]">
          <span className="inline-flex items-center gap-1"><Clock3 size={12} />{time}</span>
          {event.location && <span className="inline-flex items-center gap-1"><MapPin size={12} />{event.location}</span>}
        </div>
      </button>
      {memberMode ? (
        <button onClick={() => onToggle(event)} className={`my-auto flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${included ? "bg-[#e5efe9] text-[#34745b] hover:bg-[#d8e9df]" : "border border-[#d9d5ca] bg-[#fbfaf6] text-[#596170] hover:border-[#43876e] hover:text-[#34745b]"}`} aria-label={included ? "Remove from my calendar" : "Add to my calendar"} data-testid={`button-preference-${event.id}`}>
          {included ? <><Check size={14} /> Added</> : <><Plus size={14} /> Add</>}
        </button>
      ) : (
        <div className="my-auto flex shrink-0 items-center gap-1 opacity-100 md:opacity-0 md:transition group-hover:opacity-100">
          <button onClick={() => onEdit(event)} className="rounded-md p-2 text-[#767d86] hover:bg-[#efede6] hover:text-[#252c41]" title="Edit event" aria-label="Edit event" data-testid={`button-edit-${event.id}`}><Pencil size={15} /></button>
          <button onClick={() => onDelete(event)} className="rounded-md p-2 text-[#a25d54] hover:bg-[#f7e7e2]" title="Delete event" aria-label="Delete event" data-testid={`button-delete-${event.id}`}><Trash2 size={15} /></button>
        </div>
      )}
      {event.source === "slack" && event.sourcePermalink && <a href={event.sourcePermalink} target="_blank" rel="noreferrer" className="sr-only" aria-label="View Slack message"><ArrowUpRight size={12} /></a>}
    </article>
  );
}
