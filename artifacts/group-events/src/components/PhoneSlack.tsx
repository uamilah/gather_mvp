import { useEffect, useRef, useState, type FormEvent } from "react";
import { BatteryFull, Ban, CalendarPlus, ChevronLeft, Hash, Plus, RefreshCw, Search, SendHorizontal, Signal, Wifi } from "lucide-react";
import { CLUBS, PEOPLE, clubById, personColor } from "@/demo/seed";
import type { Event, SlackMessage } from "@/demo/types";

type Props = {
  messages: SlackMessage[];
  events: Event[];
  typing: { clubId: string; author: string } | null;
  busy: boolean;
  error: string | null;
  onSend: (clubId: string, text: string) => void;
  onOpenEvent: (id: string) => void;
};

const STARTERS: Record<string, string[]> = {
  consulting: ["should we do a resume workshop before the career fair?", "anyone down for a mock case night this week?"],
  premed: ["can we set up an MCAT study session thursday?", "is anyone organizing a hospital volunteering day?"],
  vsa: ["we should do a pho night before midterms", "when is the culture show rehearsal again?"],
  running: ["saturday long run? where should we meet", "track workout tomorrow morning anyone?"],
};

function clock(at: number) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(at));
}

function GatherCard({ message, events, onOpenEvent }: { message: SlackMessage; events: Event[]; onOpenEvent: (id: string) => void }) {
  const result = message.result;
  if (!result) return null;
  const event = events.find((item) => item.id === result.eventId);
  const label = { created: "Added to calendars", updated: "Updated on calendars", cancelled: "Marked cancelled" }[result.kind];
  const Icon = { created: CalendarPlus, updated: RefreshCw, cancelled: Ban }[result.kind];
  return (
    <button onClick={() => event && onOpenEvent(event.id)} className="pop-in mt-1.5 flex w-full max-w-[260px] items-center gap-2 rounded-lg border border-[#e1e1e1] bg-white py-1.5 pl-1.5 pr-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#252c41] text-[#a1d2b6]"><Icon size={14} /></span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-[#43876e]">Gather · {label}</span>
        {event && <span className="block truncate text-[13px] font-semibold text-[#1d1c1d]">{event.title}</span>}
      </span>
    </button>
  );
}

export function PhoneSlack({ messages, events, typing, busy, error, onSend, onOpenEvent }: Props) {
  const [channel, setChannel] = useState<string | null>(CLUBS[0].id);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const shown = channel ? messages.filter((m) => m.clubId === channel) : [];
  const club = channel ? clubById(channel) : null;
  const yours = shown.some((m) => m.author === "You");

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [shown.length, typing, channel, shown[shown.length - 1]?.result]);

  function submit(e?: FormEvent, text = draft) {
    e?.preventDefault();
    if (!channel || !text.trim() || busy) return;
    onSend(channel, text.trim());
    setDraft("");
  }

  return (
    <div className="relative h-[872px] w-[418px] rounded-[60px] bg-[#1b1b1d] p-[13px] shadow-[0_40px_80px_-20px_rgba(37,44,65,.45),inset_0_0_0_2px_#3a3a3e]">
      <div className="phone-font relative flex h-full flex-col overflow-hidden rounded-[48px] bg-white">
        {/* Status bar + dynamic island */}
        <div className={`relative flex h-[50px] shrink-0 items-end justify-between px-8 pb-1.5 text-[15px] font-semibold ${channel ? "bg-white text-black" : "bg-[#3f0e40] text-white"}`}>
          <span>9:41</span>
          <span className="absolute left-1/2 top-[11px] h-[32px] w-[118px] -translate-x-1/2 rounded-full bg-black" />
          <span className="flex items-center gap-1"><Signal size={15} strokeWidth={2.5} /><Wifi size={15} strokeWidth={2.5} /><BatteryFull size={20} strokeWidth={2} /></span>
        </div>

        {!channel ? (
          // Home: channel list
          <div className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="bg-[#3f0e40] px-4 pb-4 pt-2 text-white">
              <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[15px] font-black text-[#3f0e40]">CC</div><p className="text-[22px] font-extrabold">Campus Clubs</p></div>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-[14px] text-white/70"><Search size={15} />Jump to…</div>
            </div>
            <p className="px-4 pb-1 pt-4 text-[13px] font-bold text-[#616061]">Channels</p>
            {CLUBS.map((item) => {
              const last = messages.filter((m) => m.clubId === item.id).slice(-1)[0];
              return (
                <button key={item.id} onClick={() => setChannel(item.id)} className="flex items-center gap-3 px-4 py-2.5 text-left active:bg-[#f4f4f4]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: item.color }}><Hash size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold text-[#1d1c1d]">{item.channel}</span>
                    {last && <span className="block truncate text-[13px] text-[#616061]">{last.author}: {last.text}</span>}
                  </span>
                </button>
              );
            })}
            <div className="mt-auto flex items-center gap-2 border-t border-[#eee] px-4 py-3 text-[12px] text-[#616061]"><span className="live-dot h-2 w-2 rounded-full bg-[#2bac76]" />Gather is connected to 4 channels</div>
          </div>
        ) : (
          <>
            {/* Channel header */}
            <div className="flex shrink-0 items-center gap-1 border-b border-[#e8e8e8] px-2 pb-2.5">
              <button onClick={() => setChannel(null)} className="rounded-full p-1.5 text-[#1d1c1d]" aria-label="Back to channels"><ChevronLeft size={26} /></button>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-0.5 text-[17px] font-extrabold text-[#1d1c1d]"><Hash size={16} strokeWidth={2.75} />{club!.channel}</p>
                <p className="text-[12px] text-[#616061]">{PEOPLE[club!.id].length + 31} members · {club!.name}</p>
              </div>
              <div className="flex -space-x-1.5 pr-2">{PEOPLE[club!.id].map((p) => <span key={p.name} className="flex h-7 w-7 items-center justify-center rounded-md border-2 border-white text-[11px] font-bold text-white" style={{ background: p.color }}>{p.name[0]}</span>)}</div>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-3.5 py-3">
              {shown.map((message) => (
                <div key={message.id} className={`flex gap-2.5 ${message.at > Date.now() - 3000 ? "msg-in" : ""}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[14px] font-bold text-white" style={{ background: personColor(message.author) }}>{message.author[0]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] leading-5"><span className="font-extrabold text-[#1d1c1d]">{message.author}</span> <span className="text-[12px] text-[#7c7a7f]">{clock(message.at)}</span></p>
                    <p className="whitespace-pre-wrap break-words text-[15.5px] leading-[22px] text-[#1d1c1d]">{message.text}</p>
                    <GatherCard message={message} events={events} onOpenEvent={onOpenEvent} />
                  </div>
                </div>
              ))}
              {typing && typing.clubId === channel && (
                <div className="msg-in flex items-center gap-2 pl-1 text-[13px] text-[#616061]"><span className="typing-dots"><i /><i /><i /></span>{typing.author.split(" ")[0]} is typing…</div>
              )}
              {error && <p className="rounded-lg bg-[#fdecea] px-3 py-2 text-[13px] text-[#a1372b]">{error}</p>}
              {!yours && !typing && (
                <div className="pt-2">
                  <p className="mb-2 text-[12px] font-semibold text-[#7c7a7f]">Try saying</p>
                  <div className="flex flex-col items-start gap-1.5">
                    {STARTERS[club!.id].map((text) => <button key={text} onClick={() => submit(undefined, text)} className="rounded-2xl border border-[#d9d9d9] px-3 py-1.5 text-left text-[14px] text-[#1264a3] active:bg-[#f4f4f4]">{text}</button>)}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={submit} className="shrink-0 border-t border-[#e8e8e8] px-3 pb-2 pt-2.5">
              <div className="flex items-end gap-2">
                <span className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1f1f1] text-[#616061]"><Plus size={18} /></span>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                  rows={1}
                  placeholder={`Message #${club!.channel}`}
                  className="max-h-24 min-h-[40px] flex-1 resize-none rounded-[20px] border border-[#d9d9d9] px-3.5 py-2 text-[15.5px] leading-[22px] outline-none focus:border-[#9a9a9a]"
                  data-testid="input-chat-message"
                />
                <button type="submit" disabled={!draft.trim() || busy} className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#007a5a] text-white transition disabled:bg-[#e8e8e8] disabled:text-[#aaa]" aria-label="Send"><SendHorizontal size={16} /></button>
              </div>
            </form>
          </>
        )}
        <div className="flex h-[26px] shrink-0 items-center justify-center bg-white"><span className="h-[5px] w-[134px] rounded-full bg-black" /></div>
      </div>
    </div>
  );
}
