import { useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { Ban, CalendarDays, MessageSquareText, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { BrowserWindow } from "@/components/BrowserWindow";
import { CalendarPage } from "@/components/CalendarPage";
import { EventEditor } from "@/components/EventEditor";
import { RequiredChip, TypeChip } from "@/components/EventRow";
import { ExtensionPopup, type Highlight } from "@/components/ExtensionPopup";
import { PhoneSlack } from "@/components/PhoneSlack";
import { Stage } from "@/components/Stage";
import { REQUIRED, TYPE_STYLE } from "@/demo/colors";
import { AI_MODEL, aiSummary, getApiKey, setApiKey } from "@/demo/ai";
import { formatDay, formatTime, parseIso } from "@/demo/dates";
import { downloadIcs } from "@/demo/ics";
import { clubById } from "@/demo/seed";
import { cancelEvent, createEvent, deleteEvent, isIncluded, resetDemo, sendMessage, setIncluded, updateEvent, useDemo } from "@/demo/store";
import type { Summary } from "@/demo/summary";
import type { Event, EventInput } from "@/demo/types";

type Mode = "member" | "board";

// Scene size before scaling: phone (418) + gap + browser (1100).
const SCENE_W = 1600;
const SCENE_H = 920;

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 820);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 820);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}

function Home() {
  const demo = useDemo();
  const narrow = useNarrow();
  const [side, setSide] = useState<"phone" | "browser">("phone");
  const [mode, setMode] = useState<Mode>("member");
  const [hiddenClubs, setHiddenClubs] = useState<Set<string>>(new Set());
  const [monthOffset, setMonthOffset] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [badge, setBadge] = useState(0);
  const [editor, setEditor] = useState<{ open: boolean; event: Event | null }>({ open: false, event: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryNonce, setSummaryNonce] = useState(0);

  const included = (event: Event) => isIncluded(demo, event);
  const myEvents = useMemo(() => demo.events.filter((event) => isIncluded(demo, event) && !hiddenClubs.has(event.clubId)), [demo, hiddenClubs]);
  const flashId = demo.lastTouched && Date.now() - demo.lastTouched.at < 4000 ? demo.lastTouched.eventId : null;
  const detail = demo.events.find((event) => event.id === detailId) ?? null;

  // Refresh the AI summary when the week on the student's calendar changes.
  const sig = JSON.stringify(myEvents.map((e) => [e.id, e.title, e.date, e.startTime, e.location, e.cancelled, e.mandatory]));
  useEffect(() => {
    let alive = true;
    setSummaryLoading(true);
    const timer = window.setTimeout(() => {
      aiSummary(myEvents)
        .then((result) => { if (alive) setSummary(result); })
        .catch(() => { if (alive) setSummary({ headline: "Connect AI to get your weekly summary.", bullets: [], count: 0, required: 0 }); })
        .finally(() => { if (alive) setSummaryLoading(false); });
    }, 500);
    return () => { alive = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, summaryNonce]);

  function jumpTo(date: string) {
    const now = new Date();
    const target = parseIso(date);
    setMonthOffset((target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth());
  }

  async function send(clubId: string, text: string) {
    setBusy(true);
    setChatError(null);
    const { result, error } = await sendMessage(clubId, text);
    setBusy(false);
    if (error) {
      setChatError(error);
      if (/key|connected/i.test(error)) setSettingsOpen(true);
      return;
    }
    if (!result) return;
    setHighlight({ eventId: result.eventId, kind: result.kind, at: Date.now() });
    setBadge((count) => count + 1);
    // Let the reply land in Slack first, then drop the extension open.
    window.setTimeout(() => {
      setPopupOpen(true);
      setBadge(0);
      if (narrow) setSide("browser");
    }, 700);
  }

  // When the popup opens on a new highlight, show its month on the calendar.
  useEffect(() => {
    if (!highlight) return;
    const event = demo.events.find((item) => item.id === highlight.eventId);
    if (event) jumpTo(event.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight?.at]);

  function toggle(event: Event) {
    setIncluded(event.id, !isIncluded(demo, event));
  }

  function toggleClub(id: string) {
    setHiddenClubs((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function saveEvent(input: EventInput) {
    if (editor.event) updateEvent(editor.event.id, input);
    else {
      const created = createEvent(input);
      setHighlight({ eventId: created.id, kind: "created", at: Date.now() });
      jumpTo(created.date);
    }
    setEditor({ open: false, event: null });
  }

  function reset() {
    resetDemo();
    setHighlight(null);
    setPopupOpen(false);
    setBadge(0);
    setMonthOffset(0);
    setChatError(null);
  }

  const phone = (
    <PhoneSlack messages={demo.messages} events={demo.events} typing={demo.typing} busy={busy} error={chatError} onSend={(clubId, text) => void send(clubId, text)} onOpenEvent={(id) => { setDetailId(id); if (narrow) setSide("browser"); }} />
  );

  const browser = (
    <BrowserWindow
      badge={badge}
      popupOpen={popupOpen}
      onExtensionClick={() => { setPopupOpen(!popupOpen); setBadge(0); }}
      popup={popupOpen && (
        <ExtensionPopup
          highlight={highlight}
          events={demo.events}
          included={included}
          summary={summary}
          summaryLoading={summaryLoading}
          mode={mode}
          onMode={setMode}
          onToggle={toggle}
          onOpen={setDetailId}
          onEdit={(event) => setEditor({ open: true, event })}
          onNew={() => setEditor({ open: true, event: null })}
          onExport={() => downloadIcs(demo.events.filter((event) => isIncluded(demo, event) && !event.cancelled))}
          onClose={() => setPopupOpen(false)}
        />
      )}
    >
      <CalendarPage events={myEvents} hiddenClubs={hiddenClubs} monthOffset={monthOffset} flashId={flashId} onMonth={setMonthOffset} onToggleClub={toggleClub} onOpen={(event) => setDetailId(event.id)} />
      {editor.open && <EventEditor event={editor.event} onClose={() => setEditor({ open: false, event: null })} onSave={saveEvent} />}
      {detail && <EventDetail event={detail} mode={mode} included={isIncluded(demo, detail)} sourceText={demo.messages.find((m) => m.result?.eventId === detail.id && m.result.kind === "created")?.text ?? null} onClose={() => setDetailId(null)} onToggle={() => toggle(detail)} onEdit={() => { setEditor({ open: true, event: detail }); setDetailId(null); }} onCancel={() => cancelEvent(detail.id)} onDelete={() => { deleteEvent(detail.id); setDetailId(null); }} />}
    </BrowserWindow>
  );

  return (
    <div className="desk flex h-[100dvh] flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#252c41] text-[#a1d2b6]"><CalendarDays size={16} strokeWidth={2.5} /></span>
          <span className="display-font text-[19px] font-extrabold tracking-[-.05em] text-[#252c41]">gather</span>
          <span className="hidden truncate text-[13px] text-[#737984] md:inline">Text your club in Slack. Gather keeps your calendar in sync.</span>
        </div>
        {narrow && (
          <div className="flex rounded-lg border border-[#dfdbd0] bg-[#fbfaf6] p-0.5 text-xs font-bold">
            <button onClick={() => setSide("phone")} className={`rounded-md px-3 py-1.5 ${side === "phone" ? "bg-[#252c41] text-white" : "text-[#666d77]"}`}>Slack</button>
            <button onClick={() => setSide("browser")} className={`relative rounded-md px-3 py-1.5 ${side === "browser" ? "bg-[#252c41] text-white" : "text-[#666d77]"}`}>Calendar{badge > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#e8553e]" />}</button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setSettingsOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#737984] hover:bg-black/5" title="AI settings" aria-label="AI settings"><Sparkles size={15} /></button>
          <button onClick={reset} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[#737984] hover:bg-black/5" title="Start over" data-testid="button-reset"><RotateCcw size={14} /><span className="hidden sm:inline">Start over</span></button>
        </div>
      </header>

      {narrow ? (
        <Stage width={side === "phone" ? 460 : 1140} height={side === "phone" ? 910 : 910}>
          <div className="flex h-full items-center justify-center">{side === "phone" ? phone : browser}</div>
        </Stage>
      ) : (
        <Stage width={SCENE_W} height={SCENE_H}>
          <div className="flex h-full items-center justify-center gap-[44px]">
            <div className="flex flex-col items-center gap-3">{phone}<p className="mono-font text-[11px] font-semibold uppercase tracking-[.18em] text-[#8a8e90]">Your phone · Slack</p></div>
            <div className="flex flex-col items-center gap-3">{browser}<p className="mono-font text-[11px] font-semibold uppercase tracking-[.18em] text-[#8a8e90]">Your laptop · Chrome with Gather</p></div>
          </div>
        </Stage>
      )}

      {settingsOpen && <AiSettings current={getApiKey()} onClose={() => setSettingsOpen(false)} onSave={(key) => { setApiKey(key); setSettingsOpen(false); setChatError(null); setSummaryNonce((n) => n + 1); }} />}
    </div>
  );
}

function AiSettings({ current, onClose, onSave }: { current: string; onClose: () => void; onSave: (key: string) => void }) {
  const [value, setValue] = useState(current);
  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="fade-up w-full max-w-[440px] rounded-2xl border border-[#ded9cc] bg-[#fbfaf6] p-6 shadow-[0_24px_80px_rgba(28,35,52,.24)]" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3eefe] text-[#6d4fc2]"><Sparkles size={17} /></div><h2 id="ai-settings-title" className="display-font text-xl font-bold">AI connection</h2></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#737987] hover:bg-[#efede6]" aria-label="Close"><X size={17} /></button>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#596170]">On the hosted link, AI is already connected and you don't need this. For running locally, paste an OpenAI key to use <strong>{AI_MODEL}</strong>. It stays in this browser only.</p>
        <input value={value} onChange={(e) => setValue(e.target.value.trim())} type="password" placeholder="sk-..." autoComplete="off" className="mt-4 w-full rounded-lg border border-[#d9d5ca] bg-white px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[#6d4fc2]" />
        <div className="mt-5 flex justify-end gap-2">
          {current && <button onClick={() => onSave("")} className="mr-auto rounded-lg px-3 py-2 text-xs font-bold text-[#a25d54] hover:bg-[#f7e7e2]">Forget key</button>}
          <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-xs font-bold text-[#5e6572] hover:bg-[#efede6]">Cancel</button>
          <button onClick={() => onSave(value)} disabled={!value} className="rounded-lg bg-[#6d4fc2] px-4 py-2 text-xs font-bold text-white hover:bg-[#5b3fb0] disabled:opacity-50">Save</button>
        </div>
      </section>
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
