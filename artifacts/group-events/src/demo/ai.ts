// Optional real AI (OpenAI) for live demos. The presenter pastes a key in
// AI settings; it is kept only in that browser. Without a key, the app falls
// back to the built-in extractor and summary so the public link always works.
import { addDays, formatDay, formatTime } from "./dates";
import { clubById } from "./seed";
import type { Summary } from "./summary";
import { EVENT_TYPES, type Event, type EventType } from "./types";

const KEY_STORAGE = "gather.openaiKey";
export const AI_MODEL = "gpt-4o-mini";

export function getApiKey() {
  try { return window.localStorage.getItem(KEY_STORAGE) ?? ""; } catch { return ""; }
}

export function setApiKey(key: string) {
  try {
    if (key) window.localStorage.setItem(KEY_STORAGE, key);
    else window.localStorage.removeItem(KEY_STORAGE);
  } catch { /* ignore */ }
}

async function chat(system: string, user: string): Promise<unknown> {
  const key = getApiKey();
  if (!key) throw new Error("no key");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export type AiAction = {
  action: "create" | "update" | "cancel" | "none";
  eventId?: string;
  title?: string;
  date?: string;
  startTime?: string | null;
  location?: string;
  type?: EventType;
  mandatory?: boolean;
  description?: string | null;
};

export async function aiExtract(clubId: string, author: string, text: string, clubEvents: Event[]): Promise<AiAction> {
  const club = clubById(clubId);
  const now = new Date();
  const system = `You read student club group chat messages and keep the club calendar in sync.
Today is ${formatDay(addDays(0), { weekday: "long", year: "numeric", month: "long", day: "numeric" })} (${addDays(0)}), local time ${now.toTimeString().slice(0, 5)}.
Return JSON: {"action": "create"|"update"|"cancel"|"none", "eventId"?: string, "title"?: string, "date"?: "YYYY-MM-DD", "startTime"?: "HH:MM" (24h) or null, "location"?: string, "type"?: one of ${EVENT_TYPES.join("|")}, "mandatory"?: boolean, "description"?: string}.
- "create": the message announces a new event with at least a date or day. Write a short, clean title (e.g. "Coffee chat: Bain alumni"), not the raw message.
- "update": the message changes an existing event's date, time, location or title. Set eventId from the list and include ONLY the changed fields.
- "cancel": the message cancels an existing event. Set eventId.
- "none": chatter, questions, or anything without a plannable event.
- mandatory is true only if the message says required/mandatory/must attend.
- Resolve relative days ("Thursday", "tomorrow", "next week Tue") to dates on or after today.`;
  const existing = clubEvents.filter((e) => !e.cancelled).map((e) => ({ id: e.id, title: e.title, date: e.date, startTime: e.startTime, location: e.location }));
  const user = `Channel: #${club.channel} (${club.name})\nAuthor: ${author}\nMessage: ${text}\n\nExisting upcoming events in this club:\n${JSON.stringify(existing)}`;
  const out = (await chat(system, user)) as AiAction;
  if (out.type && !EVENT_TYPES.includes(out.type)) out.type = "other";
  return out;
}

export async function aiSummary(events: Event[], scope: "mine" | "all"): Promise<Summary> {
  const start = addDays(0);
  const end = addDays(7);
  const week = events.filter((e) => e.date >= start && e.date < end).sort((a, b) => a.date.localeCompare(b.date));
  const live = week.filter((e) => !e.cancelled);
  const rows = week.map((e) => ({
    title: e.title,
    club: clubById(e.clubId).short,
    when: `${formatDay(e.date)} ${formatTime(e.startTime)}`,
    where: e.location,
    type: e.type,
    required: e.mandatory,
    cancelled: e.cancelled,
    recentChanges: e.changes.filter((c) => Date.now() - c.at < 86_400_000).map((c) => `${c.field}: ${c.from} -> ${c.to}`),
  }));
  const system = `You are Gather, an assistant that briefs a busy college student on their club week. Tone: warm, crisp, practical, like a helpful friend on the e-board. No emojis, no em dashes.
Return JSON: {"headline": string (one sentence, max 22 words), "bullets": string[] (2-4 items, each max 22 words)}.
Prioritise: required events, anything that changed or was cancelled, time clashes, and one concrete prep tip for recruiting/networking events.`;
  const user = `Scope: ${scope === "mine" ? "events this student added to their calendar" : "all club events"}.\nNext 7 days:\n${JSON.stringify(rows)}`;
  const out = (await chat(system, user)) as { headline?: string; bullets?: string[] };
  return {
    headline: out.headline ?? "",
    bullets: (out.bullets ?? []).slice(0, 4),
    count: live.length,
    required: live.filter((e) => e.mandatory).length,
  };
}
