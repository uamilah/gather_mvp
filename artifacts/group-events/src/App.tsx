import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarDays,
  Check,
  CircleCheck,
  Download,
  LayoutGrid,
  List,
  MessageSquareText,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { EventEditor } from "@/components/EventEditor";
import { EventRow, RequiredChip, TypeChip } from "@/components/EventRow";
import { MonthGrid } from "@/components/MonthGrid";
import { ChatApp } from "@/components/ChatApp";
import { UpcomingPanel } from "@/components/UpcomingPanel";
import { REQUIRED, TYPE_STYLE } from "@/demo/colors";
import { formatDay, formatTime, parseIso } from "@/demo/dates";
import { downloadIcs } from "@/demo/ics";
import { AI_MODEL, aiSummary, getApiKey, setApiKey } from "@/demo/ai";
import { CLUBS, clubById, demoScript } from "@/demo/seed";
import {
  cancelEvent,
  createEvent,
  deleteEvent,
  getSnapshot,
  isIncluded,
  playNextMessage,
  postOwnMessage,
  resetDemo,
  scriptLength,
  setIncluded,
  updateEvent,
  useDemo,
} from "@/demo/store";
import { summarize, type Summary } from "@/demo/summary";
import { EVENT_TYPES, type Event, type EventInput, type SlackMessage } from "@/demo/types";

type Mode = "member" | "board";

function Home() {
  const demo = useDemo();
  const [mode, setMode] = useState<Mode>("member");
  const [pane, setPane] = useState<"chat" | "app">("chat"); // phones show one side at a time
  const [view, setView] = useState<"month" | "list">("month");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [hiddenClubs, setHiddenClubs] = useState<Set<string>>(new Set());
  const [monthOffset, setMonthOffset] = useState(0);
  const [editor, setEditor] = useState<{ open: boolean; event: Event | null }>({ open: false, event: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; eventId?: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setKeyState] = useState(getApiKey);
  const [aiSum, setAiSum] = useState<Summary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const noticeTimer = useRef<number | undefined>(undefined);
  const aiOn = !!apiKey;

  const memberScope = mode === "member" ? scope : "all";
  const visibleEvents = useMemo(() => demo.events.filter((event) => !hiddenClubs.has(event.clubId) && (memberScope === "all" || isIncluded(demo, event))), [demo, hiddenClubs, memberScope]);
  const summaryScope = memberScope;
  const summaryEvents = visibleEvents;
  const localSummary = useMemo(() => summarize(summaryEvents, summaryScope), [summaryEvents, summaryScope]);

  // Ask the AI for a fresh summary whenever the week's events change.
  const summarySig = JSON.stringify(summaryEvents.map((e) => [e.id, e.title, e.date, e.startTime, e.location, e.cancelled, e.mandatory]));
  useEffect(() => {
    if (!aiOn) { setAiSum(null); return; }
    let alive = true;
    setAiLoading(true);
    const timer = window.setTimeout(() => {
      aiSummary(summaryEvents, summaryScope)
        .then((result) => { if (alive) setAiSum(result.headline ? result : null); })
        .catch(() => { if (alive) setAiSum(null); })
        .finally(() => { if (alive) setAiLoading(false); });
    }, 600);
    return () => { alive = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summarySig, summaryScope, aiOn]);

  const month = new Date();
  month.setDate(1);
  month.setMonth(month.getMonth() + monthOffset);
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(month);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthEvents = visibleEvents.filter((event) => event.date.startsWith(monthKey));
  const listEvents = [...monthEvents].sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
  const grouped = listEvents.reduce<Record<string, Event[]>>((acc, event) => {
    (acc[event.date] ??= []).push(event);
    return acc;
  }, {});
  const myCount = demo.events.filter((event) => isIncluded(demo, event) && !event.cancelled).length;
  const detail = demo.events.find((event) => event.id === detailId) ?? null;
  const flashId = demo.lastTouched && Date.now() - demo.lastTouched.at < 4000 ? demo.lastTouched.eventId : null;
  const nextScript = demoScript()[demo.scriptIndex];

  const flash = (text: string, eventId?: string) => {
    setNotice({ text, eventId });
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3800);
  };

  // Jump the calendar to the month of anything the chat just touched.
  const jumpTo = (date: string) => {
    const now = new Date();
    const target = parseIso(date);
    setMonthOffset((target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth());
  };

  function reactToChat(message: SlackMessage | null) {
    if (!message?.result || message.result.kind === "ignored") return;
    const club = clubById(message.clubId);
    const eventId = message.result.eventId;
    // Read the store directly: the action just ran, so `demo` is one render behind.
    const fresh = getSnapshot().events.find((item) => item.id === eventId);
    if (fresh) jumpTo(fresh.date);
    const verb = { created: "New event from", updated: "Updated from", cancelled: "Cancelled in" }[message.result.kind];
    flash(`${verb} #${club.channel}${fresh ? `: ${fresh.title}` : ""}`, fresh?.id);
  }

  function saveEvent(input: EventInput) {
    if (editor.event) {
      updateEvent(editor.event.id, input);
      flash("Event updated. Members see the change right away");
    } else {
      const created = createEvent(input);
      jumpTo(created.date);
      flash("Event added to the club calendar", created.id);
    }
    setEditor({ open: false, event: null });
  }

  function removeEvent(event: Event) {
    if (!window.confirm(`Delete “${event.title}” from the shared calendar?`)) return;
    deleteEvent(event.id);
    setDetailId(null);
    flash("Event removed");
  }

  function toggle(event: Event) {
    const next = !isIncluded(demo, event);
    if (!next && event.mandatory && !window.confirm(`${event.title} is required by ${clubById(event.clubId).short}. Remove it from your calendar anyway?`)) return;
    setIncluded(event.id, next);
    flash(next ? `Added “${event.title}” to your calendar` : `Removed “${event.title}” from your calendar`);
  }

  function toggleClub(id: string) {
    setHiddenClubs((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function reset() {
    resetDemo();
    setMonthOffset(0);
    flash("Demo reset");
  }

  const pill = (active: boolean) => `rounded-md px-3 py-1.5 text-xs font-bold transition ${active ? "bg-[#252c41] text-white shadow-sm" : "text-[#666d77] hover:text-[#252c41]"}`;

  return (
    <div className="gather-shell flex h-[100dvh] flex-col">
      <header className="z-20 flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-[#e2ddd2] bg-[#f4f1e9] px-3 md:px-5">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#252c41] text-[#a1d2b6]"><CalendarDays size={18} strokeWidth={2.5} /><span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#f4f1e9] bg-[#f0ae86]" /></div>
          <span className="display-font text-xl font-extrabold tracking-[-.05em]">gather</span>
          <span className="hidden rounded-full border border-[#d8d3c7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7d8289] md:inline">Live demo</span>
        </div>
        <div className="flex items-center rounded-lg border border-[#dfdbd0] bg-[#fbfaf6] p-1 lg:hidden">
          <button onClick={() => setPane("chat")} className={pill(pane === "chat")}>Chat</button>
          <button onClick={() => setPane("app")} className={pill(pane === "app")}>Gather</button>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setSettingsOpen(true)} className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition ${aiOn ? "border-[#d8ccf5] bg-[#f3eefe] text-[#6d4fc2]" : "border-[#dfdbd0] bg-[#fbfaf6] text-[#666d77] hover:text-[#252c41]"}`} data-testid="button-ai-settings"><Sparkles size={14} /><span className="hidden sm:inline">{aiOn ? "AI on" : "AI off"}</span></button>
          <button onClick={reset} className="flex h-9 items-center gap-1.5 rounded-lg border border-[#dfdbd0] bg-[#fbfaf6] px-2.5 text-xs font-bold text-[#666d77] hover:text-[#252c41]" title="Reset demo" data-testid="button-reset"><RotateCcw size={14} /><span className="hidden sm:inline">Reset</span></button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(420px,44%)_1fr]">
        {/* Left: the group chat */}
        <div className={`min-h-0 border-r border-[#e2ddd2] ${pane === "chat" ? "block" : "hidden"} lg:block`}>
          <ChatApp
            messages={demo.messages}
            events={demo.events}
            scriptIndex={demo.scriptIndex}
            scriptLength={scriptLength()}
            nextScriptClub={nextScript?.clubId ?? null}
            aiOn={aiOn}
            onPlayNext={() => reactToChat(playNextMessage())}
            onSend={(clubId, author, role, text) => { void postOwnMessage(clubId, author, role, text).then(reactToChat); }}
            onOpenEvent={(id) => { setDetailId(id); }}
          />
        </div>

        {/* Right: Gather */}
        <main className={`min-h-0 overflow-y-auto ${pane === "app" ? "block" : "hidden"} lg:block`}>
          <div className="mx-auto max-w-[980px] px-4 pb-12 pt-5 md:px-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mono-font text-[10px] font-bold uppercase tracking-[.2em] text-[#43876e]">{mode === "member" ? "Every club, one calendar" : "E-board view"}</p>
                <h1 className="display-font mt-1 text-[26px] font-extrabold leading-tight tracking-[-.05em] text-[#252c41] md:text-[32px]">{mode === "member" ? "Never miss what matters." : "Post once. Everyone's calendar updates."}</h1>
              </div>
              <div className="flex items-center rounded-lg border border-[#dfdbd0] bg-[#fbfaf6] p-1">
                <button onClick={() => setMode("member")} className={pill(mode === "member")}>Member</button>
                <button onClick={() => setMode("board")} className={pill(mode === "board")}>E-board</button>
              </div>
            </div>

            <UpcomingPanel summary={aiOn && aiSum ? aiSum : localSummary} scope={summaryScope} loading={aiOn && aiLoading} source={aiOn && aiSum ? "ai" : "builtin"} />

            <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {CLUBS.map((club) => (
                  <button key={club.id} onClick={() => toggleClub(club.id)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${hiddenClubs.has(club.id) ? "border-[#ddd8cc] bg-transparent text-[#a2a29a]" : "border-transparent text-white"}`} style={hiddenClubs.has(club.id) ? undefined : { background: club.color }}>{!hiddenClubs.has(club.id) && <Check size={11} strokeWidth={3} />}{club.short}</button>
                ))}
              </div>
              {mode === "member" ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center rounded-lg border border-[#ded9cd] bg-[#fbfaf6] p-0.5">
                    <button onClick={() => setScope("all")} className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold ${scope === "all" ? "bg-[#e5efe9] text-[#34745b]" : "text-[#666d77]"}`}>All events</button>
                    <button onClick={() => setScope("mine")} className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold ${scope === "mine" ? "bg-[#e5efe9] text-[#34745b]" : "text-[#666d77]"}`}>Mine · {myCount}</button>
                  </div>
                  <button onClick={() => { downloadIcs(demo.events.filter((event) => isIncluded(demo, event) && !event.cancelled)); flash("Downloaded your calendar (.ics)"); }} className="flex h-8 items-center gap-1.5 rounded-lg border border-[#ded9cd] bg-[#fbfaf6] px-2.5 text-[11px] font-bold text-[#596170] hover:border-[#43876e] hover:text-[#34745b]" title="Export to Google / Apple Calendar"><Download size={13} />Export</button>
                </div>
              ) : (
                <button onClick={() => setEditor({ open: true, event: null })} className="flex h-9 items-center gap-1.5 rounded-lg bg-[#43876e] px-3.5 text-xs font-bold text-white shadow-[0_4px_10px_rgba(67,135,110,.15)] transition hover:bg-[#34745b]" data-testid="button-create-event"><Plus size={15} />New event</button>
              )}
            </div>

            <section className="overflow-hidden rounded-2xl border border-[#e1dcd1] bg-[#fbfaf6]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9e4d9] px-3 py-2.5 md:px-4">
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setMonthOffset(monthOffset - 1)} className="rounded-lg p-2 text-[#737984] hover:bg-[#efede6]" aria-label="Previous month"><ArrowLeft size={16} /></button>
                  <h2 className="display-font min-w-[140px] text-center text-[17px] font-extrabold tracking-[-.04em]">{monthLabel}</h2>
                  <button onClick={() => setMonthOffset(monthOffset + 1)} className="rounded-lg p-2 text-[#737984] hover:bg-[#efede6]" aria-label="Next month"><ArrowRight size={16} /></button>
                  {monthOffset !== 0 && <button onClick={() => setMonthOffset(0)} className="ml-1 rounded-md px-2 py-1 text-[11px] font-bold text-[#43876e] hover:bg-[#e5efe9]">Today</button>}
                </div>
                <div className="flex items-center rounded-lg border border-[#ded9cd] bg-white p-0.5">
                  <button onClick={() => setView("month")} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold ${view === "month" ? "bg-[#252c41] text-white" : "text-[#666d77]"}`}><LayoutGrid size={13} />Month</button>
                  <button onClick={() => setView("list")} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold ${view === "list" ? "bg-[#252c41] text-white" : "text-[#666d77]"}`}><List size={13} />List</button>
                </div>
              </div>

              {view === "month" ? (
                <MonthGrid month={month} events={monthEvents} flashId={flashId} onOpen={(event) => setDetailId(event.id)} />
              ) : listEvents.length ? (
                <div>
                  {Object.entries(grouped).map(([date, dayEvents]) => (
                    <div key={date}>
                      <p className="mono-font bg-[#f7f5ef] px-5 py-1.5 text-[10px] font-semibold uppercase tracking-[.15em] text-[#888c8e]">{formatDay(date, { weekday: "long", month: "long", day: "numeric" })}</p>
                      {dayEvents.map((event) => <EventRow key={event.id} event={event} included={isIncluded(demo, event)} memberMode={mode === "member"} flash={flashId === event.id} onToggle={toggle} onOpen={(e) => setDetailId(e.id)} onEdit={(e) => setEditor({ open: true, event: e })} onDelete={removeEvent} />)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e9efe8] text-[#43876e]"><CalendarDays size={23} /></div>
                  <h3 className="display-font mt-4 text-xl font-bold">Nothing this month.</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#777d86]">{scope === "mine" && mode === "member" ? "You haven't added anything for this month. Switch to All events to browse." : "Try another month or turn more clubs on."}</p>
                </div>
              )}
              <Legend />
            </section>
          </div>
        </main>
      </div>

      {notice && (
        <button onClick={() => notice.eventId && setDetailId(notice.eventId)} className="fade-up fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-xl border border-[#cfe2d6] bg-[#fbfaf6] px-4 py-3 text-left text-sm font-semibold text-[#34745b] shadow-lg" role="status">
          <Check size={16} className="shrink-0" /><span className="truncate">{notice.text}</span>
        </button>
      )}
      {settingsOpen && <AiSettings current={apiKey} onClose={() => setSettingsOpen(false)} onSave={(key) => { setApiKey(key); setKeyState(key); setSettingsOpen(false); flash(key ? "AI is on. New chat messages go to the model" : "AI off. Using the built-in reader"); }} />}
      {editor.open && <EventEditor event={editor.event} onClose={() => setEditor({ open: false, event: null })} onSave={saveEvent} />}
      {detail && <EventDetail event={detail} mode={mode} included={isIncluded(demo, detail)} sourceText={demo.messages.find((m) => m.result && "eventId" in m.result && m.result.eventId === detail.id && m.result.kind === "created")?.text ?? null} onClose={() => setDetailId(null)} onToggle={() => toggle(detail)} onEdit={() => { setEditor({ open: true, event: detail }); setDetailId(null); }} onCancel={() => { cancelEvent(detail.id); flash("Event cancelled. Members were updated"); }} onDelete={() => removeEvent(detail)} />}
    </div>
  );
}

function AiSettings({ current, onClose, onSave }: { current: string; onClose: () => void; onSave: (key: string) => void }) {
  const [value, setValue] = useState(current);
  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="fade-up w-full max-w-[440px] rounded-2xl border border-[#ded9cc] bg-[#fbfaf6] p-6 shadow-[0_24px_80px_rgba(28,35,52,.24)]" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3eefe] text-[#6d4fc2]"><Sparkles size={17} /></div><h2 id="ai-settings-title" className="display-font text-xl font-bold">Live AI</h2></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#737987] hover:bg-[#efede6]" aria-label="Close"><X size={17} /></button>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#596170]">Paste an OpenAI key to have <strong>{AI_MODEL}</strong> read chat messages and write the summary. The key stays in this browser only. Without a key, the demo uses the built-in reader.</p>
        <input value={value} onChange={(e) => setValue(e.target.value.trim())} type="password" placeholder="sk-..." autoComplete="off" className="mt-4 w-full rounded-lg border border-[#d9d5ca] bg-white px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[#6d4fc2]" />
        <div className="mt-5 flex justify-end gap-2">
          {current && <button onClick={() => onSave("")} className="mr-auto rounded-lg px-3 py-2 text-xs font-bold text-[#a25d54] hover:bg-[#f7e7e2]">Turn off &amp; forget key</button>}
          <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-xs font-bold text-[#5e6572] hover:bg-[#efede6]">Cancel</button>
          <button onClick={() => onSave(value)} disabled={!value} className="rounded-lg bg-[#6d4fc2] px-4 py-2 text-xs font-bold text-white hover:bg-[#5b3fb0] disabled:opacity-50">Save</button>
        </div>
      </section>
    </div>
  );
}

function Legend({ dark = false }: { dark?: boolean }) {
  return (
    <div className={dark ? "mt-8 px-2" : "border-t border-[#e9e4d9] px-4 py-3"}>
      <p className={`mono-font mb-2 text-[9px] font-semibold uppercase tracking-[.18em] ${dark ? "text-[#8991a2]" : "text-[#94958f]"}`}>Color key</p>
      <div className={dark ? "grid grid-cols-2 gap-x-2 gap-y-1.5" : "flex flex-wrap gap-x-3 gap-y-1.5"}>
        {EVENT_TYPES.map((type) => (
          <span key={type} className={`flex items-center gap-1.5 text-[11px] ${dark ? "text-[#d9ddd9]" : "text-[#666d77]"}`}><span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_STYLE[type].dot }} />{TYPE_STYLE[type].label}</span>
        ))}
        <span className={`flex items-center gap-1.5 text-[11px] font-bold ${dark ? "text-[#f0b5aa]" : ""}`} style={dark ? undefined : { color: REQUIRED.fg }}><CircleCheck size={12} strokeWidth={2.75} />Required</span>
      </div>
    </div>
  );
}

type DetailProps = { event: Event; mode: Mode; included: boolean; sourceText: string | null; onClose: () => void; onToggle: () => void; onEdit: () => void; onCancel: () => void; onDelete: () => void };

function EventDetail({ event, mode, included, sourceText, onClose, onToggle, onEdit, onCancel, onDelete }: DetailProps) {
  const club = clubById(event.clubId);
  return (
    <div className="modal-backdrop fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="fade-up max-h-[92dvh] w-full max-w-[500px] overflow-y-auto rounded-t-2xl border border-[#ded9cc] bg-[#fbfaf6] shadow-[0_24px_80px_rgba(28,35,52,.24)] sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="event-detail-heading">
        <div className="flex items-start justify-between p-6 text-[#f5f1e7]" style={{ background: "#252c41", boxShadow: `inset 0 -4px 0 ${event.mandatory ? REQUIRED.border : TYPE_STYLE[event.type].dot}` }}>
          <div className="min-w-0">
            <p className="mono-font flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.17em] text-[#a1d2b6]"><span className="h-2 w-2 rounded-full" style={{ background: club.color }} />{club.name}</p>
            <h2 id="event-detail-heading" className={`display-font mt-2 text-2xl font-bold leading-tight ${event.cancelled ? "line-through opacity-70" : ""}`}>{event.title}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5"><TypeChip type={event.type} />{event.mandatory && <RequiredChip />}{event.cancelled && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#252c41]">Cancelled</span>}</div>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-lg text-white/70 hover:bg-white/10" aria-label="Close event details">×</button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[#f2efe6] p-3"><p className="mono-font text-[9px] uppercase tracking-wider text-[#8a8f92]">When</p><p className="mt-1 text-sm font-bold">{formatDay(event.date, { weekday: "short", month: "long", day: "numeric" })}</p><p className="mt-0.5 text-xs text-[#777d86]">{formatTime(event.startTime)}</p></div>
            <div className="rounded-lg bg-[#f2efe6] p-3"><p className="mono-font text-[9px] uppercase tracking-wider text-[#8a8f92]">Where</p><p className="mt-1 break-words text-sm font-bold">{event.location || "Location TBD"}</p></div>
          </div>
          {event.description && <p className="text-sm leading-6 text-[#596170]">{event.description}</p>}
          {sourceText && (
            <div className="rounded-lg border-l-4 border-[#4a154b] bg-[#f8f4f8] px-3.5 py-2.5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#4a154b]"><MessageSquareText size={11} />Found in #{club.channel}</p>
              <p className="mt-1 text-[13px] leading-5 text-[#3b3b3b]">“{sourceText}”</p>
            </div>
          )}
          {event.changes.length > 0 && (
            <div>
              <p className="mono-font mb-2 text-[9px] uppercase tracking-wider text-[#8a8f92]">Change history</p>
              <ul className="space-y-1.5">
                {[...event.changes].reverse().map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-5 text-[#596170]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4a12a]" /><span><strong className="capitalize">{change.field}</strong> {change.from} → <strong>{change.to}</strong> <span className="text-[#9a9d9f]">· {change.via === "slack" ? "from Slack" : "by E-board"}</span></span></li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e9e4d9] pt-4">
            {mode === "member" && !event.cancelled && <button onClick={onToggle} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold ${included ? "border border-[#d9d5ca] text-[#596170]" : "bg-[#43876e] text-white hover:bg-[#34745b]"}`}>{included ? <><X size={13} />Remove from my calendar</> : <><Plus size={13} />Add to my calendar</>}</button>}
            {mode === "board" && (
              <>
                <button onClick={onDelete} className="mr-auto flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-[#a25d54] hover:bg-[#f7e7e2]"><Trash2 size={13} />Delete</button>
                {!event.cancelled && <button onClick={onCancel} className="flex items-center gap-1.5 rounded-lg border border-[#d9d5ca] px-3 py-2 text-xs font-bold text-[#596170] hover:border-[#a25d54] hover:text-[#a25d54]"><Ban size={13} />Cancel event</button>}
                <button onClick={onEdit} className="flex items-center gap-1.5 rounded-lg bg-[#43876e] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#34745b]"><Pencil size={13} />Edit</button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Router /></WouterRouter>;
}

export default App;
