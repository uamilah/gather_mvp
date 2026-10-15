// In-browser stand-in for the backend. State lives in localStorage and syncs
// live across tabs, so an E-board tab and a member tab update each other.
import { useSyncExternalStore } from "react";
import { extract } from "./extract";
import { aiExtract, getApiKey, type AiAction } from "./ai";
import { addDays, formatDay, formatTime } from "./dates";
import { demoScript, seedEvents, seedMessages } from "./seed";
import type { Change, Event, EventInput, SlackMessage } from "./types";

type State = {
  events: Event[];
  prefs: Record<string, boolean>; // eventId -> on my calendar
  messages: SlackMessage[];
  scriptIndex: number;
  lastTouched: { eventId: string; at: number } | null;
};

const KEY = "gather.demo.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

function fresh(): State {
  const { events, prefs } = seedEvents();
  return { events, prefs, messages: seedMessages(), scriptIndex: 0, lastTouched: null };
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
  return s.prefs[event.id] ?? event.mandatory;
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

// ---- Slack simulation ----

export function scriptLength() {
  return demoScript().length;
}

function postMessage(message: SlackMessage) {
  commit({ ...state, messages: [...state.messages, message] });
}

export function playNextMessage(): SlackMessage | null {
  const step = demoScript()[state.scriptIndex];
  if (!step) return null;
  const messageId = `m-${uid()}`;
  let result: SlackMessage["result"] = { kind: "ignored" };
  const action = step.action;
  if (action.kind === "create") {
    if (!state.events.some((event) => event.id === action.id)) createEvent(action.input, "slack", messageId, action.id);
    result = { kind: "created", eventId: action.id };
  } else if (action.kind === "update" && state.events.some((event) => event.id === action.id)) {
    updateEvent(action.id, action.patch, "slack");
    result = { kind: "updated", eventId: action.id };
  } else if (action.kind === "cancel" && state.events.some((event) => event.id === action.id)) {
    cancelEvent(action.id, "slack");
    result = { kind: "cancelled", eventId: action.id };
  }
  const message: SlackMessage = { id: messageId, clubId: step.clubId, author: step.author, role: step.role, text: step.text, at: Date.now(), result };
  commit({ ...state, messages: [...state.messages, message], scriptIndex: state.scriptIndex + 1 });
  return message;
}

// A message typed live by whoever is demoing.
function localAction(clubId: string, text: string): AiAction {
  const found = extract(text);
  const recent = [...state.events].filter((event) => event.clubId === clubId && !event.cancelled).sort((a, b) => b.updatedAt - a.updatedAt);
  const target = found.title ? recent.find((event) => sharesWord(event.title, found.title!)) ?? recent[0] : recent[0];
  if (found.intent === "cancel" && target) return { action: "cancel", eventId: target.id };
  if (found.intent === "update" && target && (found.date || found.startTime || found.location)) {
    return { action: "update", eventId: target.id, ...(found.date && { date: found.date }), ...(found.startTime && { startTime: found.startTime }), ...(found.location && { location: found.location }) };
  }
  if (found.date || found.startTime) {
    return { action: "create", title: found.title ?? "New event", date: found.date ?? addDays(0), startTime: found.startTime, location: found.location ?? "Location TBD", type: found.type, mandatory: found.mandatory };
  }
  return { action: "none" };
}

function applyAction(clubId: string, messageId: string, act: AiAction): SlackMessage["result"] {
  const exists = act.eventId && state.events.some((event) => event.id === act.eventId);
  if (act.action === "cancel" && exists) {
    cancelEvent(act.eventId!, "slack");
    return { kind: "cancelled", eventId: act.eventId! };
  }
  if (act.action === "update" && exists) {
    const patch: Partial<EventInput> = {};
    if (act.title) patch.title = act.title;
    if (act.date) patch.date = act.date;
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
  return { kind: "ignored" };
}

// A message typed live in the chat. It appears at once as "reading", then the
// AI (or the built-in extractor when no key is set) decides what it means.
export async function postOwnMessage(clubId: string, author: string, role: string, text: string): Promise<SlackMessage> {
  const messageId = `m-${uid()}`;
  postMessage({ id: messageId, clubId, author, role, text, at: Date.now(), result: null });
  let act: AiAction;
  let via: "ai" | "local" = "local";
  try {
    if (!getApiKey()) throw new Error("no key");
    act = await aiExtract(clubId, author, text, state.events.filter((event) => event.clubId === clubId));
    via = "ai";
  } catch {
    act = localAction(clubId, text);
  }
  const result = applyAction(clubId, messageId, act);
  commit({ ...state, messages: state.messages.map((message) => message.id === messageId ? { ...message, result, via } : message) });
  return state.messages.find((message) => message.id === messageId)!;
}

function sharesWord(a: string, b: string) {
  const words = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const wa = words(a);
  return [...words(b)].some((w) => wa.has(w));
}

export function resetDemo() {
  commit(fresh());
}
