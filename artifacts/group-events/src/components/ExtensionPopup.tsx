import { Ban, CalendarPlus, Check, CircleCheck, Clock3, Download, MapPin, Pencil, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { REQUIRED, TYPE_STYLE } from "@/demo/colors";
import { addDays, formatDay, formatTime } from "@/demo/dates";
import { clubById } from "@/demo/seed";
import type { Summary } from "@/demo/summary";
import type { Event } from "@/demo/types";
import { RequiredChip, TypeChip } from "./EventRow";

export type Highlight = { eventId: string; kind: "created" | "updated" | "cancelled"; at: number };
type Mode = "member" | "board";

type Props = {
  highlight: Highlight | null;
  events: Event[];
  included: (event: Event) => boolean;
  summary: Summary | null;
  summaryLoading: boolean;
  mode: Mode;
  onMode: (mode: Mode) => void;
  onToggle: (event: Event) => void;
  onOpen: (id: string) => void;
  onEdit: (event: Event) => void;
  onNew: () => void;
  onExport: () => void;
  onClose: () => void;
};

export function ExtensionPopup({ highlight, events, included, summary, summaryLoading, mode, onMode, onToggle, onOpen, onEdit, onNew, onExport, onClose }: Props) {
  const event = highlight ? events.find((item) => item.id === highlight.eventId) : null;
  const upcoming = events
    .filter((item) => !item.cancelled && item.date >= addDays(0) && item.date < addDays(14))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  return (
    <div className="popup-drop absolute right-[86px] top-[44px] z-40 w-[380px] origin-top-right">
      <div className="ml-auto mr-[6px] h-3 w-3 translate-y-1.5 rotate-45 border-l border-t border-[#dcdfe3] bg-white" />
      <div className="max-h-[700px] overflow-y-auto rounded-xl border border-[#dcdfe3] bg-white shadow-[0_18px_50px_rgba(28,35,52,.22)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#eceae4] bg-[#fbfaf6] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#252c41] text-[#a1d2b6]"><CalendarPlus size={15} /></span>
            <span className="display-font text-[18px] font-extrabold tracking-[-.05em] text-[#252c41]">gather</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-md border border-[#e0dcd2] bg-white p-0.5 text-[11px] font-bold">
              {(["member", "board"] as const).map((value) => <button key={value} onClick={() => onMode(value)} className={`rounded px-2 py-1 ${mode === value ? "bg-[#252c41] text-white" : "text-[#666d77]"}`}>{value === "member" ? "Member" : "E-board"}</button>)}
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-[#8a8e90] hover:bg-[#efede6]" aria-label="Close"><X size={16} /></button>
          </div>
        </div>

        {event && highlight && (
          <div key={highlight.at} className="pop-in border-b border-[#eceae4] p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#43876e]">
              {highlight.kind === "created" ? <CalendarPlus size={13} /> : highlight.kind === "updated" ? <RefreshCw size={13} /> : <Ban size={13} />}
              {highlight.kind === "created" ? "New event found" : highlight.kind === "updated" ? "Event updated" : "Event cancelled"} in #{clubById(event.clubId).channel}
            </p>
            <div className="rounded-xl border border-[#e6e2d8] p-3.5" style={{ boxShadow: `inset 4px 0 0 ${event.mandatory ? REQUIRED.border : TYPE_STYLE[event.type].dot}` }}>
              <div className="flex flex-wrap gap-1.5"><TypeChip type={event.type} />{event.mandatory && <RequiredChip />}</div>
              <p className={`mt-1.5 text-[16px] font-bold leading-5 text-[#252c41] ${event.cancelled ? "line-through opacity-60" : ""}`}>{event.title}</p>
              <div className="mt-2 space-y-1 text-[12.5px] text-[#596170]">
                <p className="flex items-center gap-1.5"><Clock3 size={13} />{formatDay(event.date, { weekday: "long", month: "short", day: "numeric" })} · {formatTime(event.startTime)}</p>
                <p className="flex items-center gap-1.5"><MapPin size={13} />{event.location}</p>
              </div>
              {highlight.kind === "updated" && event.changes.length > 0 && (
                <div className="mt-2.5 space-y-1 rounded-lg bg-[#fff6e0] px-2.5 py-2 text-[12px] text-[#7a5a12]">
                  {event.changes.filter((c) => c.at >= highlight.at - 5000).map((c, i) => <p key={i}><span className="capitalize">{c.field}</span>: <span className="line-through opacity-70">{c.from}</span> → <strong>{c.to}</strong></p>)}
                </div>
              )}
            </div>
            {!event.cancelled && mode === "member" && (
              <button onClick={() => onToggle(event)} className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-bold transition ${included(event) ? "bg-[#e5efe9] text-[#2f6b53]" : "bg-[#43876e] text-white"}`}>
                {included(event) ? <><Check size={14} />On your calendar · tap to remove</> : <><Plus size={14} />Add to my calendar</>}
              </button>
            )}
          </div>
        )}

        <div className="p-4">
          <div className="rounded-xl bg-[#252c41] p-3.5 text-[#f5f1e7]">
            <p className="mono-font flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[.16em] text-[#c4cbbb]"><Sparkles size={12} className="text-[#f0ae86]" />AI summary · next 7 days</p>
            {summaryLoading || !summary ? (
              <div className="mt-3 space-y-1.5"><div className="h-3.5 w-4/5 animate-pulse rounded bg-white/10" /><div className="h-3.5 w-3/5 animate-pulse rounded bg-white/10" /></div>
            ) : (
              <div className="fade-up">
                <p className="mt-2 text-[14px] font-semibold leading-5">{summary.headline}</p>
                <ul className="mt-2 space-y-1">{summary.bullets.map((b) => <li key={b} className="flex gap-1.5 text-[12px] leading-[17px] text-[#dfe2dc]"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#a1d2b6]" />{b}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="mb-2 mt-4 flex items-center justify-between">
            <p className="mono-font text-[10px] font-semibold uppercase tracking-[.16em] text-[#8a8e90]">Coming up · all clubs</p>
            {mode === "member"
              ? <button onClick={onExport} className="flex items-center gap-1 text-[11px] font-bold text-[#43876e]"><Download size={12} />Export</button>
              : <button onClick={onNew} className="flex items-center gap-1 rounded-md bg-[#43876e] px-2 py-1 text-[11px] font-bold text-white"><Plus size={12} />New event</button>}
          </div>
          <div className="space-y-0.5">
            {upcoming.map((item) => {
              const on = included(item);
              return (
                <div key={item.id} className={`flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-[#f6f4ee] ${highlight?.eventId === item.id ? "bg-[#fff6e0]" : ""}`}>
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: item.mandatory ? REQUIRED.border : TYPE_STYLE[item.type].dot }} />
                  <button onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-left">
                    <p className={`flex items-center gap-1 truncate text-[13px] font-semibold ${on || mode === "board" ? "text-[#252c41]" : "text-[#9a9d9f]"}`}>{item.mandatory && <CircleCheck size={12} strokeWidth={2.75} style={{ color: REQUIRED.fg }} className="shrink-0" />}<span className="truncate">{item.title}</span></p>
                    <p className="truncate text-[11px] text-[#8a8e90]">{clubById(item.clubId).short} · {formatDay(item.date)} · {formatTime(item.startTime)}</p>
                  </button>
                  {mode === "member" ? (
                    <button onClick={() => onToggle(item)} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${on ? "border-[#43876e] bg-[#43876e] text-white" : "border-[#d0ccc1] text-transparent hover:border-[#43876e]"}`} aria-label={on ? "Remove from my calendar" : "Add to my calendar"}><Check size={14} strokeWidth={3} /></button>
                  ) : (
                    <button onClick={() => onEdit(item)} className="rounded-md p-1 text-[#767d86] hover:bg-[#efede6]" aria-label="Edit"><Pencil size={14} /></button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
