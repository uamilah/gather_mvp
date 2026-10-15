// In-browser stand-in for the backend. State lives in localStorage and syncs
// live across tabs, so an E-board tab and a member tab update each other.
import { useSyncExternalStore } from "react";
import { aiChatTurn, type CalendarAction } from "./ai";
import { formatDay, formatTime } from "./dates";
import { PEOPLE, seedEvents, seedMessages } from "./seed";
import type { Change, Event, EventInput, SlackMessage } from "./types";

type State = {
  events: Event[];
  prefs: Record<string, boolean>; // eventId -> on my calendar
  messages: SlackMessage[];
  typing: { clubId: string; author: string } | null;
  lastTouched: { eventId: string; at: number } | null;
};

const KEY = "gather.demo.v2";
const uid = () => Math.random().toString(36).slice(2, 10);

function fresh(): State {
  const { events, prefs } = seedEvents();
  return { events, prefs, messages: seedMessages(), typing: null, lastTouched: null };
}

function load(): State {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return fresh();
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: keep in memory only */
  }
  listeners.forEach((fn) => fn());
}

window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  state = e.newValue ? (JSON.parse(e.newValue) as State) : fresh();
  listeners.forEach((fn) => fn());
});

export function useDemo() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

export function getSnapshot() {
  return state;
}

export function isIncluded(s: State, event: Event) {
  return s.prefs[event.id] ?? true; // Gather adds club events by default; you remove what you don't want
}

// ---- E-board actions ----

export function createEvent(input: EventInput, source: Event["source"] = "board", sourceMessageId: string | null = null, id = uid()) {
  const event: Event = { ...input, id, cancelled: false, source, sourceMessageId, changes: [], updatedAt: Date.now() };
  commit({ ...state, events: [...state.events, event], lastTouched: { eventId: id, at: Date.now() } });
  return event;
}

function diff(before: Event, patch: Partial<EventInput>, via: Change["via"]): Change[] {
  const at = Date.now();
  const out: Change[] = [];
  if (patch.startTime !== undefined && patch.startTime !== before.startTime) out.push({ at, via, field: "time", from: formatTime(before.startTime), to: formatTime(patch.startTime) });
  if (patch.date !== undefined && patch.date !== before.date) out.push({ at, via, field: "date", from: formatDay(before.date), to: formatDay(patch.date) });
  if (patch.location !== undefined && patch.location !== before.location) out.push({ at, via, field: "location", from: before.location, to: patch.location });
  if (patch.title !== undefined && patch.title !== before.title) out.push({ at, via, field: "title", from: before.title, to: patch.title });
  return out;
}

export function updateEvent(id: string, patch: Partial<EventInput>, via: Change["via"] = "board") {
  commit({
    ...state,
    events: state.events.map((event) => event.id === id ? { ...event, ...patch, changes: [...event.changes, ...diff(event, patch, via)], updatedAt: Date.now() } : event),
    lastTouched: { eventId: id, at: Date.now() },
  });
}

export function cancelEvent(id: string, via: Change["via"] = "board") {
  commit({
    ...state,
    events: state.events.map((event) => event.id === id ? { ...event, cancelled: true, changes: [...event.changes, { at: Date.now(), via, field: "status", from: "Scheduled", to: "Cancelled" }], updatedAt: Date.now() } : event),
    lastTouched: { eventId: id, at: Date.now() },
  });
}

export function deleteEvent(id: string) {
  const prefs = { ...state.prefs };
  delete prefs[id];
  commit({ ...state, events: state.events.filter((event) => event.id !== id), prefs });
}

// ---- Member actions ----

export function setIncluded(id: string, included: boolean) {
  commit({ ...state, prefs: { ...state.prefs, [id]: included } });
}

// ---- Chat (AI plays the other club members) ----

function postMessage(message: SlackMessage) {
  commit({ ...state, messages: [...state.messages, message] });
}

function setMessageResult(id: string, result: SlackMessage["result"]) {
  commit({ ...state, messages: state.messages.map((message) => message.id === id ? { ...message, result } : message) });
}

function applyAction(clubId: string, messageId: string, act: CalendarAction): SlackMessage["result"] {
  const exists = act.eventId && state.events.some((event) => event.id === act.eventId);
  if (act.action === "cancel" && exists) {
    cancelEvent(act.eventId!, "slack");
    return { kind: "cancelled", eventId: act.eventId! };
  }
  if (act.action === "update" && exists) {
    const patch: Partial<EventInput> = {};
    if (act.title) patch.title = act.title;
    if (act.date && /^\d{4}-\d{2}-\d{2}$/.test(act.date)) patch.date = act.date;
    if (act.startTime !== undefined) patch.startTime = act.startTime;
    if (act.location) patch.location = act.location;
    if (act.mandatory !== undefined) patch.mandatory = act.mandatory;
    updateEvent(act.eventId!, patch, "slack");
    return { kind: "updated", eventId: act.eventId! };
  }
  if (act.action === "create" && act.date && /^\d{4}-\d{2}-\d{2}$/.test(act.date)) {
    const event = createEvent({
      clubId,
      title: act.title || "New event",
      date: act.date,
      startTime: act.startTime ?? null,
      location: act.location || "Location TBD",
      description: act.description ?? null,
      type: act.type ?? "other",
      mandatory: !!act.mandatory,
    }, "slack", messageId);
    return { kind: "created", eventId: event.id };
  }
  return null;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

// You post; the AI answers as club members (with typing), then Gather acts on the
// conversation. Returns the calendar result, if any, for the extension popup.
export async function sendMessage(clubId: string, text: string): Promise<{ result: SlackMessage["result"]; error?: string }> {
  postMessage({ id: `m-${uid()}`, clubId, author: "You", role: "Member", text, at: Date.now(), result: null });
  const people = PEOPLE[clubId];
  commit({ ...state, typing: { clubId, author: people[0].name } });
  try {
    const turn = await aiChatTurn(clubId, state.messages.filter((m) => m.clubId === clubId), state.events.filter((e) => e.clubId === clubId));
    let lastId = state.messages[state.messages.length - 1].id;
    for (const [i, reply] of turn.replies.entries()) {
      commit({ ...state, typing: { clubId, author: reply.author } });
      await wait(i === 0 ? 500 : Math.min(600 + reply.text.length * 25, 2200));
      const person = people.find((p) => p.name === reply.author) ?? people[0];
      lastId = `m-${uid()}`;
      commit({ ...state, typing: null, messages: [...state.messages, { id: lastId, clubId, author: person.name, role: person.role, text: reply.text, at: Date.now(), result: null }] });
    }
    commit({ ...state, typing: null });
    const result = applyAction(clubId, lastId, turn.calendar);
    if (result) {
      await wait(350);
      setMessageResult(lastId, result);
    }
    return { result };
  } catch (error) {
    commit({ ...state, typing: null });
    return { result: null, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

export function resetDemo() {
  commit(fresh());
}
