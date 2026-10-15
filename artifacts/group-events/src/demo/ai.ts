// All the AI in the demo: one OpenAI call per chat message (club members reply
// in character AND decide what changes on the calendar), plus a short weekly
// summary. The key is pasted in the app and kept only in that browser.
import { addDays, formatDay, formatTime } from "./dates";
import { PEOPLE, clubById } from "./seed";
import type { Summary } from "./summary";
import { EVENT_TYPES, type Event, type EventType, type SlackMessage } from "./types";

const KEY_STORAGE = "gather.openaiKey";
export const AI_MODEL = "gpt-4o-mini";

export function getApiKey() {
  try { return window.localStorage.getItem(KEY_STORAGE) ?? import.meta.env.VITE_OPENAI_KEY ?? ""; } catch { return ""; }
}

export function setApiKey(key: string) {
  try {
    if (key) window.localStorage.setItem(KEY_STORAGE, key);
    else window.localStorage.removeItem(KEY_STORAGE);
  } catch { /* ignore */ }
}

// Calls go through our server function (/api/chat), which holds the key.
// A key pasted locally (or VITE_OPENAI_KEY in .env.local) calls OpenAI directly,
// which is handy for local development.
async function chat(system: string, user: string, maxTokens: number): Promise<unknown> {
  const key = getApiKey();
  const body = { model: AI_MODEL, temperature: 0.7, max_tokens: maxTokens, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] };
  const res = key
    ? await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body) })
    : await fetch(`${import.meta.env.BASE_URL}api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 401) throw new Error("The OpenAI key was rejected");
  if (res.status === 404 || res.status === 405) throw new Error("AI isn't connected here. Add a key in settings");
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export type CalendarAction = {
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

export type ChatTurn = { replies: { author: string; text: string }[]; calendar: CalendarAction };

export async function aiChatTurn(clubId: string, history: SlackMessage[], clubEvents: Event[]): Promise<ChatTurn> {
  const club = clubById(clubId);
  const people = PEOPLE[clubId];
  const today = addDays(0);
  const system = `You run a realistic demo of Gather, a Chrome extension that reads college club Slack channels and keeps students' calendars in sync.

PART 1: ROLEPLAY. You play the other members of #${club.channel} (${club.name}, a ${club.kind.toLowerCase()} club). The user is a club member texting from their phone.
Characters: ${people.map((p) => `${p.name} (${p.role}): ${p.vibe}`).join("; ")}.
- Reply as 1 or 2 of these characters (never as the user), like real college students on Slack: short, casual, lowercase is fine, an emoji sometimes. Max 25 words per message.
- Be helpful planners: if the user floats an idea, run with it and pin down specifics (a day, a time, a place on campus). If details change, react naturally. Officers can confirm or announce plans.
- Stay in character. Never mention AI, Gather, or calendars unless the user does.

PART 2: CALENDAR. After your replies, decide what Gather does, based on the whole conversation including your replies.
- "create": a new event now has at least a specific day (time and place optional). Clean short title, e.g. "Resume workshop", "Coffee chat: Bain alumni".
- "update": an existing event's day, time, place or title changed. Use its eventId and include only changed fields.
- "cancel": an existing event was called off. Use its eventId.
- "none": still brainstorming, chatter, or nothing new. Do not re-create events that already exist.
- mandatory is true only if someone says required, mandatory or must attend.
Today is ${formatDay(today, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} (${today}). Resolve days like "thursday" or "next week" to dates on or after today.

Return JSON only:
{"replies":[{"author": one of ${JSON.stringify(people.map((p) => p.name))}, "text": string}],
 "calendar":{"action":"create"|"update"|"cancel"|"none","eventId"?:string,"title"?:string,"date"?:"YYYY-MM-DD","startTime"?:"HH:MM" 24h or null,"location"?:string,"type"?:${JSON.stringify(EVENT_TYPES)},"mandatory"?:boolean,"description"?:string}}`;
  const convo = history.slice(-12).map((m) => `${m.author}${m.author === "You" ? "" : ` (${m.role})`}: ${m.text}`).join("\n");
  const existing = clubEvents.filter((e) => !e.cancelled && e.date >= today).map((e) => ({ eventId: e.id, title: e.title, date: e.date, startTime: e.startTime, location: e.location }));
  const user = `Club events already on the calendar:\n${JSON.stringify(existing)}\n\nConversation so far (latest last):\n${convo}`;
  const out = (await chat(system, user, 500)) as Partial<ChatTurn>;
  const names = new Set(people.map((p) => p.name));
  const calendar = out.calendar ?? { action: "none" };
  if (calendar.type && !EVENT_TYPES.includes(calendar.type)) calendar.type = "other";
  return {
    replies: (out.replies ?? []).filter((r) => names.has(r.author) && r.text).slice(0, 2),
    calendar,
  };
}

export async function aiSummary(events: Event[]): Promise<Summary> {
  const start = addDays(0);
  const end = addDays(7);
  const week = events.filter((e) => e.date >= start && e.date < end).sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  const live = week.filter((e) => !e.cancelled);
  const rows = week.map((e) => ({
    title: e.title,
    club: clubById(e.clubId).short,
    when: `${formatDay(e.date)} ${formatTime(e.startTime)}`,
    where: e.location,
    required: e.mandatory,
    cancelled: e.cancelled,
    justChanged: e.changes.filter((c) => Date.now() - c.at < 86_400_000).map((c) => `${c.field}: ${c.from} -> ${c.to}`),
  }));
  const system = `You are Gather, briefing a busy college student on their club week. Warm, crisp, practical. No emojis, no em dashes.
Return JSON: {"headline": one sentence, max 18 words, "bullets": 2 or 3 strings, max 18 words each}.
Prioritise required events, things that just changed or were cancelled, clashes, and one prep tip for recruiting or networking events.`;
  const out = (await chat(system, `Today is ${formatDay(start)}. Next 7 days on their calendar:\n${JSON.stringify(rows)}`, 250)) as { headline?: string; bullets?: string[] };
  return { headline: out.headline ?? "", bullets: (out.bullets ?? []).slice(0, 3), count: live.length, required: live.filter((e) => e.mandatory).length };
}
