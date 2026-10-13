import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import {
  getGetEventQueryKey,
  getGetSlackSettingsQueryKey,
  getGetUpcomingSummaryQueryKey,
  getListCalendarPreferencesQueryKey,
  getListEventsQueryKey,
  getListSlackChannelsQueryKey,
  useCreateEvent,
  useDeleteEvent,
  useGetEvent,
  useGetSlackSettings,
  useGetUpcomingSummary,
  useListCalendarPreferences,
  useListEvents,
  useListSlackChannels,
  useSaveSlackSettings,
  useSetCalendarPreference,
  useSyncSlackConversation,
  useUpdateEvent,
} from "@workspace/api-client-react";
import type { Event, EventInput } from "@workspace/api-client-react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  ListFilter,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { EventEditor } from "@/components/EventEditor";
import { EventRow } from "@/components/EventRow";
import { SlackPanel } from "@/components/SlackPanel";
import { UpcomingPanel } from "@/components/UpcomingPanel";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: false } },
});

function getMemberId() {
  const key = "gather.memberId";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `gather-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, id);
  }
  return id;
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function Home() {
  const client = useQueryClient();
  const memberId = useMemo(getMemberId, []);
  const [mode, setMode] = useState<"member" | "organizer">("member");
  const [monthOffset, setMonthOffset] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [editor, setEditor] = useState<{ open: boolean; event: Event | null }>({ open: false, event: null });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [syncResult, setSyncResult] = useState<Awaited<ReturnType<ReturnType<typeof useSyncSlackConversation>["mutateAsync"]>> | null>(null);
  const [syncError, setSyncError] = useState("");

  const eventQuery = useListEvents({ query: { queryKey: getListEventsQueryKey(), refetchInterval: 15_000 } });
  const events = eventQuery.data?.events ?? [];
  const prefQuery = useListCalendarPreferences(memberId, { query: { queryKey: getListCalendarPreferencesQueryKey(memberId) } });
  const preferences = prefQuery.data?.preferences ?? [];
  const slackChannelsQuery = useListSlackChannels({ query: { queryKey: getListSlackChannelsQueryKey() } });
  const slackSettingsQuery = useGetSlackSettings({ query: { queryKey: getGetSlackSettingsQueryKey(), refetchInterval: 15_000 } });
  const summaryQuery = useGetUpcomingSummary({ query: { queryKey: getGetUpcomingSummaryQueryKey(), refetchInterval: 15_000 } });
  const detailQuery = useGetEvent(detailId ?? "", { query: { enabled: !!detailId, queryKey: getGetEventQueryKey(detailId ?? "") } });

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const setPreference = useSetCalendarPreference();
  const saveSlackSettings = useSaveSlackSettings();
  const syncSlack = useSyncSlackConversation();

  const selectedDate = new Date();
  selectedDate.setDate(1);
  selectedDate.setMonth(selectedDate.getMonth() + monthOffset);
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(selectedDate);
  const filteredEvents = useMemo(() => events
    .filter((event) => showAll || dateKey(new Date(`${event.date}T00:00:00`)) === dateKey(selectedDate))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99")), [events, showAll, monthOffset]);
  const groupedEvents = useMemo(() => filteredEvents.reduce<Record<string, Event[]>>((groups, event) => {
    (groups[event.date] ??= []).push(event);
    return groups;
  }, {}), [filteredEvents]);
  const includedIds = useMemo(() => new Set(preferences.filter((item) => item.included).map((item) => item.eventId)), [preferences]);
  const detail = detailQuery.data ?? events.find((event) => event.id === detailId) ?? null;
  const busy = createEvent.isPending || updateEvent.isPending;

  const invalidateEvents = async (eventId?: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: getListEventsQueryKey() }),
      client.invalidateQueries({ queryKey: getGetUpcomingSummaryQueryKey() }),
      ...(eventId ? [client.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) })] : []),
    ]);
  };
  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3200);
  };

  function saveEvent(input: EventInput) {
    if (editor.event) {
      updateEvent.mutate({ eventId: editor.event.id, data: input }, {
        onSuccess: async (saved) => {
          await invalidateEvents(saved.id);
          setEditor({ open: false, event: null });
          flash("Event updated");
        },
        onError: (error) => flash(`Couldn't update event: ${messageOf(error)}`),
      });
    } else {
      createEvent.mutate({ data: input }, {
        onSuccess: async (created) => {
          await invalidateEvents(created.id);
          setEditor({ open: false, event: null });
          setMonthOffset(monthOffsetForDate(created.date));
          setShowAll(false);
          flash("Event added to the calendar");
        },
        onError: (error) => flash(`Couldn't create event: ${messageOf(error)}`),
      });
    }
  }

  function monthOffsetForDate(value: string) {
    const now = new Date();
    const target = new Date(`${value}T00:00:00`);
    return (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
  }

  function removeEvent(event: Event) {
    if (!window.confirm(`Delete “${event.title}” from the shared calendar?`)) return;
    deleteEvent.mutate({ eventId: event.id }, {
      onSuccess: async () => {
        await invalidateEvents(event.id);
        await client.invalidateQueries({ queryKey: getListCalendarPreferencesQueryKey(memberId) });
        setDetailId(null);
        flash("Event removed");
      },
      onError: (error) => flash(`Couldn't delete event: ${messageOf(error)}`),
    });
  }

  function togglePreference(event: Event) {
    const included = !includedIds.has(event.id);
    setPreference.mutate({ memberId, eventId: event.id, data: { included } }, {
      onSuccess: async () => {
        await client.invalidateQueries({ queryKey: getListCalendarPreferencesQueryKey(memberId) });
        flash(included ? "Added to your calendar" : "Removed from your calendar");
      },
      onError: (error) => flash(`Couldn't save your choice: ${messageOf(error)}`),
    });
  }

  function chooseSlackChannel(channelId: string | null) {
    saveSlackSettings.mutate({ data: { channelId } }, {
      onSuccess: async () => {
        await client.invalidateQueries({ queryKey: getGetSlackSettingsQueryKey() });
        flash(channelId ? "Slack channel selected" : "Slack channel cleared");
      },
      onError: (error) => flash(`Couldn't save Slack settings: ${messageOf(error)}`),
    });
  }

  function doSync() {
    const channelId = slackSettingsQuery.data?.selectedChannel?.id;
    if (!channelId) return;
    setSyncResult(null);
    setSyncError("");
    syncSlack.mutate({ data: { channelId } }, {
      onSuccess: async (result) => {
        setSyncResult(result);
        await Promise.all([
          invalidateEvents(),
          client.invalidateQueries({ queryKey: getGetSlackSettingsQueryKey() }),
          client.invalidateQueries({ queryKey: getListSlackChannelsQueryKey() }),
        ]);
      },
      onError: (error) => {
        const message = messageOf(error);
        setSyncError(message);
        flash(`Slack sync failed: ${message}`);
      },
    });
  }

  const currentMonthCount = events.filter((event) => dateKey(new Date(`${event.date}T00:00:00`)) === dateKey(selectedDate)).length;
  const nextEvents = events.filter((event) => event.date >= new Date().toISOString().slice(0, 10)).length;

  return (
    <div className="gather-shell flex min-h-[100dvh]">
      <aside className="gather-sidebar hidden w-[248px] shrink-0 flex-col justify-between px-5 py-6 lg:flex">
        <div>
          <div className="flex items-center gap-3 px-2">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#a1d2b6] text-[#252c41]">
              <CalendarDays size={20} strokeWidth={2.5} />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#252c41] bg-[#f0ae86]" />
            </div>
            <div><p className="display-font text-[22px] font-extrabold tracking-[-.06em]">gather</p><p className="-mt-1 text-[10px] tracking-[.12em] text-[#bdc4c1]">CLUB CALENDAR</p></div>
          </div>
          <div className="mt-11 px-2"><p className="mono-font mb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[#8991a2]">Workspace</p>
            <div className="flex items-center gap-3 rounded-xl bg-white/[.08] px-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#efbd83] text-sm font-extrabold text-[#252c41]">A</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">Astronomy Club</p><p className="mt-0.5 text-[11px] text-[#bdc4c1]">12 members</p></div>
              <ChevronDown size={14} className="text-[#bdc4c1]" />
            </div>
          </div>
          <nav className="mt-9 space-y-1">
            <p className="mono-font mb-3 px-2 text-[9px] font-semibold uppercase tracking-[.18em] text-[#8991a2]">Your space</p>
            <button onClick={() => setMode("member")} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === "member" ? "bg-[#a1d2b6] text-[#252c41]" : "text-[#d9ddd9] hover:bg-white/[.08]"}`} data-testid="button-mode-member"><CalendarDays size={17} />My calendar</button>
            <button onClick={() => setMode("organizer")} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${mode === "organizer" ? "bg-[#a1d2b6] text-[#252c41]" : "text-[#d9ddd9] hover:bg-white/[.08]"}`} data-testid="button-mode-organizer"><UsersRound size={17} />Organizer board</button>
          </nav>
          <div className="mt-10 rounded-xl border border-white/10 bg-white/[.04] p-4">
            <div className="flex items-center gap-2 text-[#f0bd91]"><ShieldCheck size={15} /><span className="text-xs font-bold">Your calendar, your call</span></div>
            <p className="mt-2 text-[11px] leading-[1.65] text-[#c0c5c5]">Choose which club plans land on your personal calendar. Required events are clearly marked.</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-2 pt-4 text-[10px] text-[#abb2b5]"><span>Gather MVP</span><button title="About Gather" onClick={() => flash("Gather keeps the club schedule clear and member-controlled.")} className="rounded p-1 hover:bg-white/10" data-testid="button-about"><CircleHelp size={15} /></button></div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-[#e2ddd2] bg-[#f4f1e9]/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3 lg:hidden"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#252c41] text-[#a1d2b6]"><CalendarDays size={18} /></div><span className="display-font text-xl font-extrabold tracking-[-.05em]">gather</span></div>
          <div className="hidden items-center gap-2 text-xs text-[#8a8e90] lg:flex"><span>Workspace</span><span>/</span><span className="font-semibold text-[#434a59]">Calendar</span></div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-[#dfdbd0] bg-[#fbfaf6] p-1">
              <button onClick={() => setMode("member")} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${mode === "member" ? "bg-[#252c41] text-white shadow-sm" : "text-[#666d77] hover:text-[#252c41]"}`} data-testid="header-mode-member">Member</button>
              <button onClick={() => setMode("organizer")} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${mode === "organizer" ? "bg-[#252c41] text-white shadow-sm" : "text-[#666d77] hover:text-[#252c41]"}`} data-testid="header-mode-organizer">Organizer</button>
            </div>
            <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#f0bd91] text-xs font-extrabold text-[#333548]" title="Your local member profile">Y</div>
          </div>
        </header>

        <div className="mx-auto max-w-[1480px] px-4 pb-10 pt-7 md:px-8 md:pt-9">
          <div className="mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div className="fade-up">
              <div className="mb-2 flex items-center gap-2"><span className="mono-font text-[10px] font-bold uppercase tracking-[.2em] text-[#43876e]">{mode === "member" ? "YOUR CLUB, IN SYNC" : "BOARD / ORGANIZER VIEW"}</span><span className="h-px w-8 bg-[#d5cfc2]" /></div>
              <h1 className="display-font text-[34px] font-extrabold leading-tight tracking-[-.055em] text-[#252c41] md:text-[42px]">{mode === "member" ? "Plans worth showing up for." : "The club’s next moves."}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#737984]">{mode === "member" ? "One shared schedule from the plans in Slack. Keep what matters on your calendar." : "Keep the shared calendar clear, current, and easy for everyone to follow."}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => { setShowAll(!showAll); }} className={`flex h-10 items-center gap-2 rounded-lg border px-3.5 text-xs font-bold transition ${showAll ? "border-[#43876e] bg-[#e5efe9] text-[#34745b]" : "border-[#ded9cd] bg-[#fbfaf6] text-[#626976] hover:border-[#b9c4b9]"}`} data-testid="button-toggle-all-events"><ListFilter size={15} />{showAll ? "All dates" : "This month"}</button>
              {mode === "organizer" && <button onClick={() => setEditor({ open: true, event: null })} className="flex h-10 items-center gap-2 rounded-lg bg-[#43876e] px-4 text-sm font-bold text-white shadow-[0_4px_10px_rgba(67,135,110,.15)] transition hover:-translate-y-0.5 hover:bg-[#34745b]" data-testid="button-create-event"><Plus size={16} />New event</button>}
            </div>
          </div>

          {notice && <div className="fixed right-4 top-[82px] z-40 flex items-center gap-2 rounded-xl border border-[#cfe2d6] bg-[#fbfaf6] px-4 py-3 text-sm font-semibold text-[#34745b] shadow-lg" role="status" data-testid="status-feedback"><Check size={16} />{notice}</div>}

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
            <section className="fade-up min-w-0 overflow-hidden rounded-2xl border border-[#e1dcd1] bg-[#fbfaf6]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9e4d9] px-4 py-4 md:px-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#252c41] text-[#a1d2b6]"><CalendarDays size={18} /></div>
                  <div><div className="flex items-baseline gap-2"><h2 className="display-font text-xl font-extrabold tracking-[-.04em]">{showAll ? "All events" : monthLabel}</h2><span className="rounded-full bg-[#eeece4] px-2 py-0.5 text-[10px] font-bold text-[#727984]">{showAll ? events.length : currentMonthCount}</span></div><p className="mt-0.5 text-[11px] text-[#7d8289]">{mode === "member" ? "Your personal picks from the club calendar" : "Shared schedule · changes visible to the club"}</p></div>
                </div>
                <div className="flex items-center gap-1">
                  <button disabled={showAll} onClick={() => setMonthOffset(monthOffset - 1)} className="rounded-lg p-2 text-[#737984] transition hover:bg-[#efede6] disabled:opacity-30" aria-label="Previous month" data-testid="button-previous-month"><ArrowLeft size={16} /></button>
                  <button disabled={showAll} onClick={() => setMonthOffset(0)} className="rounded-md px-2 py-1 text-[11px] font-bold text-[#656c76] hover:bg-[#efede6] disabled:opacity-0" data-testid="button-current-month">Today</button>
                  <button disabled={showAll} onClick={() => setMonthOffset(monthOffset + 1)} className="rounded-lg p-2 text-[#737984] transition hover:bg-[#efede6] disabled:opacity-30" aria-label="Next month" data-testid="button-next-month"><ArrowRight size={16} /></button>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-[#eee9df] bg-[#f7f5ef] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] text-[#94958f]">
                <span>{showAll ? `${events.length} on the shared calendar` : `${monthLabel} · ${currentMonthCount} scheduled`}</span>
                <span className="hidden sm:inline">{mode === "member" ? `${includedIds.size} in your calendar` : "Organizer controls"}</span>
              </div>

              {eventQuery.isLoading ? <div className="space-y-4 p-5" aria-label="Loading events"><div className="h-16 animate-pulse rounded-xl bg-[#efede6]" /><div className="h-16 animate-pulse rounded-xl bg-[#efede6]" /><div className="h-16 animate-pulse rounded-xl bg-[#efede6]" /></div> : eventQuery.isError ? (
                <div className="p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#f7e7e2] text-[#a25d54]"><Clock3 size={20} /></div><p className="mt-3 font-bold">Calendar didn’t load</p><p className="mt-1 text-sm text-[#777d86]">Your shared events are temporarily unavailable.</p><button onClick={() => eventQuery.refetch()} className="mt-4 rounded-lg bg-[#252c41] px-4 py-2 text-xs font-bold text-white" data-testid="button-retry-events">Try again</button></div>
              ) : !filteredEvents.length ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e9efe8] text-[#43876e]"><CalendarDays size={23} /></div>
                  <h3 className="display-font mt-4 text-xl font-bold">{showAll ? "A clear calendar, for now." : "No plans on the page yet."}</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#777d86]">{mode === "organizer" ? "Create an event or connect the club’s Slack channel to bring plans in." : "Nothing is scheduled in this month. Check other dates or ask an organizer to add a plan."}</p>
                  <div className="mt-5 flex justify-center gap-2">
                    {mode === "organizer" && <button onClick={() => setEditor({ open: true, event: null })} className="flex items-center gap-1.5 rounded-lg bg-[#43876e] px-3.5 py-2.5 text-xs font-bold text-white" data-testid="button-empty-create"><Plus size={14} />Add an event</button>}
                    <button onClick={() => setShowAll(true)} className="rounded-lg border border-[#dcd8ce] bg-white px-3.5 py-2.5 text-xs font-bold text-[#596170]" data-testid="button-empty-all-dates">See all dates</button>
                  </div>
                </div>
              ) : (
                <div>
                  {Object.entries(groupedEvents).map(([date, dayEvents]) => (
                    <div key={date}>
                      <div className="flex items-center justify-between bg-[#fbfaf6] px-5 pb-1 pt-4"><p className="mono-font text-[10px] font-semibold uppercase tracking-[.15em] text-[#888c8e]">{new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${date}T00:00:00`))}</p><span className="text-[10px] text-[#a2a29a]">{dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}</span></div>
                      {dayEvents.map((event) => <EventRow key={event.id} event={event} included={includedIds.has(event.id)} memberMode={mode === "member"} onToggle={togglePreference} onOpen={(selected) => setDetailId(selected.id)} onEdit={(selected) => setEditor({ open: true, event: selected })} onDelete={removeEvent} />)}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[#e9e4d9] bg-[#f7f5ef] px-5 py-3 text-[10px] text-[#898d91]"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#43876e]" />{nextEvents} upcoming events total</span><span className="mono-font">GATHER / SHARED CALENDAR</span></div>
            </section>

            <aside className="space-y-5">
              <UpcomingPanel summary={summaryQuery.data} loading={summaryQuery.isLoading} error={summaryQuery.isError} onRetry={() => summaryQuery.refetch()} />
              <SlackPanel
                channels={slackChannelsQuery.data?.channels}
                settings={slackSettingsQuery.data}
                connected={slackChannelsQuery.data?.connected ?? false}
                loading={slackChannelsQuery.isLoading || slackSettingsQuery.isLoading}
                saving={saveSlackSettings.isPending}
                syncing={syncSlack.isPending}
                error={syncError || slackSettingsQuery.data?.error || slackChannelsQuery.data?.error || (slackSettingsQuery.isError ? messageOf(slackSettingsQuery.error) : slackChannelsQuery.isError ? messageOf(slackChannelsQuery.error) : null)}
                latestSync={syncResult}
                onSelect={chooseSlackChannel}
                onSync={doSync}
                onRetry={() => { if (syncError) doSync(); else { void slackChannelsQuery.refetch(); void slackSettingsQuery.refetch(); } }}
              />
              <section className="rounded-2xl border border-[#e2ddd2] bg-[#fbfaf6] p-5" data-testid="panel-calendar-choice">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f6e9dc] text-[#b5744e]"><SlidersHorizontal size={15} /></div><h2 className="text-sm font-bold">Your calendar</h2></div><span className="mono-font text-[10px] font-bold text-[#43876e]">YOU</span></div>
                <p className="mt-3 text-xs leading-5 text-[#767c85]">The shared list is for the club. Use <strong className="font-semibold text-[#535b67]">Add</strong> on anything you want in your own calendar.</p>
                <div className="mt-4 flex items-center justify-between border-t border-[#eae5da] pt-3"><span className="text-xs font-medium text-[#666d77]">Included by you</span><span className="rounded-full bg-[#e5efe9] px-2.5 py-1 text-xs font-bold text-[#34745b]">{includedIds.size} events</span></div>
                <button onClick={() => setMode("member")} className="mt-3 w-full rounded-lg border border-[#ded9cd] px-3 py-2 text-xs font-bold text-[#596170] transition hover:border-[#43876e] hover:text-[#34745b]" data-testid="button-open-my-calendar">Review your calendar</button>
              </section>
              <div className="flex items-start gap-3 px-2 text-[11px] leading-5 text-[#8a8e90]"><CircleHelp size={14} className="mt-0.5 shrink-0" /><p>Slack checks every {slackSettingsQuery.data?.pollSeconds ?? "—"} seconds. Plans shared by the club can be added here; your personal include choices stay yours.</p></div>
            </aside>
          </div>
        </div>
      </main>

      {editor.open && <EventEditor event={editor.event} busy={busy} onClose={() => setEditor({ open: false, event: null })} onSave={saveEvent} />}
      {detailId && detail && (
        <div className="modal-backdrop fixed inset-0 z-40 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && setDetailId(null)}>
          <section className="fade-up w-full max-w-[480px] overflow-hidden rounded-2xl border border-[#ded9cc] bg-[#fbfaf6] shadow-[0_24px_80px_rgba(28,35,52,.24)]" role="dialog" aria-modal="true" aria-labelledby="event-detail-heading" data-testid="dialog-event-detail">
            <div className="flex items-start justify-between bg-[#252c41] p-6 text-[#f5f1e7]"><div><p className="mono-font text-[10px] font-semibold uppercase tracking-[.17em] text-[#a1d2b6]">{detail.source === "slack" ? `From Slack${detail.sourceChannelName ? ` · #${detail.sourceChannelName}` : ""}` : "Shared club event"}</p><h2 id="event-detail-heading" className="display-font mt-2 text-2xl font-bold leading-tight">{detail.title}</h2></div><button onClick={() => setDetailId(null)} className="rounded-lg px-2 py-1 text-lg text-white/70 hover:bg-white/10" aria-label="Close event details" data-testid="button-close-detail">×</button></div>
            <div className="space-y-4 p-6">
              {detailQuery.isLoading && <div className="h-10 animate-pulse rounded-lg bg-[#efede6]" />}
              <div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-[#f2efe6] p-3"><p className="mono-font text-[9px] uppercase tracking-wider text-[#8a8f92]">When</p><p className="mt-1 text-sm font-bold">{new Intl.DateTimeFormat("en", { weekday: "short", month: "long", day: "numeric" }).format(new Date(`${detail.date}T00:00:00`))}</p><p className="mt-0.5 text-xs text-[#777d86]">{detail.startTime || "Time to be confirmed"}</p></div><div className="rounded-lg bg-[#f2efe6] p-3"><p className="mono-font text-[9px] uppercase tracking-wider text-[#8a8f92]">Where</p><p className="mt-1 text-sm font-bold">{detail.location || "Location to be confirmed"}</p><p className="mt-0.5 text-xs capitalize text-[#777d86]">{detail.type}</p></div></div>
              {detail.description && <div><p className="mono-font text-[9px] uppercase tracking-wider text-[#8a8f92]">Details</p><p className="mt-1 text-sm leading-6 text-[#596170]">{detail.description}</p></div>}
              {detail.mandatory && <div className="rounded-lg border border-[#f0d3cc] bg-[#fbefeb] px-3.5 py-3 text-xs font-semibold text-[#9d4b40]">Required for club members</div>}
              <div className="flex items-center justify-between border-t border-[#e9e4d9] pt-4">
                {detail.source === "slack" && detail.sourcePermalink ? <a href={detail.sourcePermalink} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#43876e] underline underline-offset-4" data-testid="link-source-message">Open source message</a> : <span className="text-[11px] text-[#898e93]">Added by an organizer</span>}
                {mode === "organizer" && detail.source === "board" && <button onClick={() => { setEditor({ open: true, event: detail }); setDetailId(null); }} className="rounded-lg bg-[#43876e] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#34745b]" data-testid="button-detail-edit">Edit event</button>}
                {mode === "member" && <button onClick={() => togglePreference(detail)} className="rounded-lg bg-[#43876e] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#34745b]" data-testid="button-detail-preference">{includedIds.has(detail.id) ? "Remove from my calendar" : "Add to my calendar"}</button>}
              </div>
            </div>
          </section>
        </div>
      )}
      {detailId && detailQuery.isError && !detail && <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-[#252c41] px-4 py-3 text-sm text-white" role="alert">Event details couldn’t be loaded. <button onClick={() => detailQuery.refetch()} className="ml-2 underline" data-testid="button-retry-detail">Retry</button></div>}
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
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
