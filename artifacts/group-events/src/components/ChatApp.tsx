import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Ban, CalendarPlus, ChevronDown, Hash, Loader2, Play, RefreshCw, SendHorizontal, Sparkles } from "lucide-react";
import { CLUBS, clubById } from "@/demo/seed";
import type { Event, SlackMessage } from "@/demo/types";

// People you can post as, per club: an officer and a regular member.
const PEOPLE: Record<string, { name: string; role: string }[]> = {
  consulting: [{ name: "Priya Shah", role: "VP Events" }, { name: "Jordan Wells", role: "Member" }],
  premed: [{ name: "Dana Kim", role: "Secretary" }, { name: "Marcus Lee", role: "Member" }],
  vsa: [{ name: "Linh Tran", role: "President" }, { name: "Kevin Pham", role: "Member" }],
  running: [{ name: "Sam Ortiz", role: "Captain" }, { name: "Ava Chen", role: "Member" }],
};

const AVATAR: Record<string, string> = {
  "Priya Shah": "#6d5bd0", "Jordan Wells": "#2f6f80", "Dana Kim": "#b0503f", "Marcus Lee": "#3f7f9a",
  "Linh Tran": "#c27a1a", "Kevin Pham": "#8a6db5", "Sam Ortiz": "#3f7f5f", "Ava Chen": "#d9825b",
};

type Props = {
  messages: SlackMessage[];
  events: Event[];
  scriptIndex: number;
  scriptLength: number;
  nextScriptClub: string | null;
  aiOn: boolean;
  onPlayNext: () => void;
  onSend: (clubId: string, author: string, role: string, text: string) => void;
  onOpenEvent: (id: string) => void;
};

function time(at: number) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(at));
}

function GatherReply({ message, events, onOpenEvent }: { message: SlackMessage; events: Event[]; onOpenEvent: (id: string) => void }) {
  const result = message.result;
  if (!result) {
    return <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6b6a6b]"><Loader2 size={12} className="animate-spin" />Gather is reading…</p>;
  }
  if (result.kind === "ignored") return null;
  const event = events.find((item) => item.id === result.eventId);
  const label = { created: "Added to the calendar", updated: "Updated the event", cancelled: "Marked as cancelled" }[result.kind];
  const Icon = { created: CalendarPlus, updated: RefreshCw, cancelled: Ban }[result.kind];
  return (
    <button onClick={() => event && onOpenEvent(event.id)} disabled={!event} className="fade-up mt-1.5 flex max-w-full items-center gap-2 rounded-lg border border-[#d6e6dc] bg-[#f1f8f4] py-1.5 pl-1.5 pr-3 text-left transition hover:border-[#43876e] disabled:opacity-60">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#43876e] text-white"><Icon size={13} /></span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#43876e]">Gather · {label}</span>
        {event && <span className="block truncate text-[12.5px] font-semibold text-[#1d1c1d]">{event.title}</span>}
      </span>
    </button>
  );
}

export function ChatApp({ messages, events, scriptIndex, scriptLength, nextScriptClub, aiOn, onPlayNext, onSend, onOpenEvent }: Props) {
  const [channel, setChannel] = useState(CLUBS[0].id);
  const [personIdx, setPersonIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Record<string, number>>(Object.fromEntries(CLUBS.map((item) => [item.id, messages.filter((m) => m.clubId === item.id).length])));
  const club = clubById(channel);
  const person = PEOPLE[channel][personIdx] ?? PEOPLE[channel][0];
  const shown = useMemo(() => messages.filter((message) => message.clubId === channel), [messages, channel]);
  const done = scriptIndex >= scriptLength;

  // Follow the conversation: when a scripted message lands in another channel, jump there.
  const last = messages[messages.length - 1];
  useEffect(() => {
    if (last && last.at > Date.now() - 2000 && last.clubId !== channel) { setChannel(last.clubId); setPersonIdx(0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id]);

  useEffect(() => {
    seen.current[channel] = messages.filter((m) => m.clubId === channel).length;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [shown.length, channel, messages, last?.result]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(channel, person.name, person.role, draft.trim());
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-white">
      {/* Workspace sidebar */}
      <nav className="hidden w-[200px] shrink-0 flex-col bg-[#3f0e40] text-[#cfc3cf] sm:flex">
        <div className="border-b border-white/10 px-4 py-3.5">
          <p className="flex items-center gap-1 text-[15px] font-extrabold text-white">Campus Clubs <ChevronDown size={14} /></p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px]"><span className="live-dot h-2 w-2 rounded-full bg-[#2bac76]" />Gather connected</p>
        </div>
        <p className="px-4 pb-1 pt-4 text-[12px] font-semibold">Channels</p>
        {CLUBS.map((item) => {
          const unread = messages.filter((m) => m.clubId === item.id).length - (seen.current[item.id] ?? 0);
          const active = item.id === channel;
          return (
            <button key={item.id} onClick={() => { setChannel(item.id); setPersonIdx(0); }} className={`mx-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-[14px] ${active ? "bg-[#1164a3] text-white" : unread > 0 ? "font-bold text-white hover:bg-white/10" : "hover:bg-white/10"}`}>
              <Hash size={14} className="shrink-0 opacity-70" /><span className="truncate">{item.channel}</span>
              {!active && unread > 0 && <span className="ml-auto rounded-full bg-[#cd2553] px-1.5 text-[10px] font-bold text-white">{unread}</span>}
            </button>
          );
        })}
        <div className="mt-auto space-y-2 border-t border-white/10 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Demo script</p>
          <button onClick={onPlayNext} disabled={done} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#007a5a] px-2 py-2 text-[12px] font-bold text-white transition hover:bg-[#148567] disabled:bg-white/10 disabled:text-white/40" data-testid="button-play-next">
            <Play size={12} fill="currentColor" />{done ? "Script done" : `Next message ${scriptIndex + 1}/${scriptLength}`}
          </button>
          {!done && nextScriptClub && <p className="text-center text-[10px] text-white/50">in #{clubById(nextScriptClub).channel}</p>}
        </div>
      </nav>

      {/* Channel */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-[#e8e8e8] px-4 py-2.5">
          <div className="min-w-0">
            {/* Phones: channel picker in place of the sidebar */}
            <select value={channel} onChange={(e) => { setChannel(e.target.value); setPersonIdx(0); }} className="max-w-full bg-transparent text-[15px] font-extrabold text-[#1d1c1d] outline-none sm:hidden">
              {CLUBS.map((item) => <option key={item.id} value={item.id}>#{item.channel}</option>)}
            </select>
            <p className="hidden items-center gap-1 text-[16px] font-extrabold text-[#1d1c1d] sm:flex"><Hash size={16} />{club.channel}</p>
            <p className="truncate text-[11px] text-[#6b6a6b]">{club.name} · {club.kind}</p>
          </div>
          <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${aiOn ? "bg-[#f3eefe] text-[#6d4fc2]" : "bg-[#f1f1f1] text-[#777]"}`}><Sparkles size={11} />{aiOn ? "AI reading" : "Built-in reader"}</span>
          <button onClick={onPlayNext} disabled={done} className="flex shrink-0 items-center gap-1 rounded-md bg-[#007a5a] px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-40 sm:hidden"><Play size={11} fill="currentColor" />Next</button>
        </header>

        <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="pb-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg text-white" style={{ background: club.color }}><Hash size={22} /></div>
            <p className="mt-2 text-[18px] font-extrabold text-[#1d1c1d]">Welcome to #{club.channel}</p>
            <p className="text-[13px] text-[#6b6a6b]">Plans posted here show up on Gather automatically.</p>
          </div>
          {shown.map((message) => (
            <div key={message.id} className="group flex gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: AVATAR[message.author] ?? "#616061" }}>{message.author[0]}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-5"><span className="font-extrabold text-[#1d1c1d]">{message.author}</span> <span className="text-[11px] text-[#6b6a6b]">{message.role} · {time(message.at)}</span></p>
                <p className="whitespace-pre-wrap break-words text-[14.5px] leading-[22px] text-[#1d1c1d]">{message.text}</p>
                <GatherReply message={message} events={events} onOpenEvent={onOpenEvent} />
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="px-4 pb-4">
          <div className="rounded-xl border border-[#bbb] focus-within:border-[#1d1c1d] focus-within:shadow-[0_0_0_1px_#1d1c1d]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); } }}
              rows={2}
              placeholder={`Message #${club.channel}`}
              className="block w-full resize-none bg-transparent px-3 pt-2.5 text-[14.5px] outline-none"
              data-testid="input-chat-message"
            />
            <div className="flex items-center justify-between gap-2 px-2 pb-2">
              <label className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-[#6b6a6b] hover:bg-[#f4f4f4]">
                <span className="h-4 w-4 shrink-0 rounded" style={{ background: AVATAR[person.name] }} />
                <span className="shrink-0">Posting as</span>
                <select value={personIdx} onChange={(e) => setPersonIdx(Number(e.target.value))} className="min-w-0 bg-transparent font-bold text-[#1d1c1d] outline-none">
                  {PEOPLE[channel].map((p, i) => <option key={p.name} value={i}>{p.name} ({p.role})</option>)}
                </select>
              </label>
              <button type="submit" disabled={!draft.trim()} className="flex h-8 w-9 shrink-0 items-center justify-center rounded-md bg-[#007a5a] text-white disabled:bg-transparent disabled:text-[#bbb]" aria-label="Send"><SendHorizontal size={16} /></button>
            </div>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-[#8a8a8a]">Try: “Resume workshop Thursday 5pm in Library 210” or “update: moved to 6pm, Zoom instead”</p>
        </form>
      </section>
    </div>
  );
}
