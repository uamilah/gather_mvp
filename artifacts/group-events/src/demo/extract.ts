// Lightweight event extraction for messages typed live during a demo.
// The real product would use an LLM here; this covers the common phrasings.
import { addDays, daysUntil, iso, today } from "./dates";
import type { EventType } from "./types";

export type Extracted = {
  intent: "create" | "update" | "cancel" | "none";
  title: string | null;
  date: string | null;
  startTime: string | null;
  location: string | null;
  type: EventType;
  mandatory: boolean;
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function findDate(text: string): { date: string; match: string } | null {
  const lower = text.toLowerCase();
  let m = lower.match(/\b(today|tonight|tomorrow)\b/);
  if (m) return { date: addDays(m[1] === "tomorrow" ? 1 : 0), match: m[0] };
  m = lower.match(/\b(?:(next|this)\s+)?(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?\b/);
  if (m) {
    const idx = WEEKDAYS.findIndex((day) => day.startsWith(m![2].slice(0, 3)));
    const offset = idx === today().getDay() && m[1] !== "next" ? 0 : daysUntil(idx);
    return { date: addDays(offset), match: m[0] };
  }
  m = lower.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) return { date: resolveMonthDay(Number(m[1]) - 1, Number(m[2])), match: m[0] };
  m = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (m) return { date: resolveMonthDay(MONTHS.indexOf(m[1].slice(0, 3)), Number(m[2])), match: m[0] };
  return null;
}

function resolveMonthDay(month: number, day: number) {
  const now = today();
  const d = new Date(now.getFullYear(), month, day);
  if (d < now) d.setFullYear(d.getFullYear() + 1);
  return iso(d);
}

function findTime(text: string): { time: string; match: string } | null {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i) ?? text.match(/\bat\s+(\d{1,2}):(\d{2})\b/i);
  if (!m) return /\bnoon\b/i.test(text) ? { time: "12:00", match: "noon" } : null;
  let hour = Number(m[1]);
  const minute = m[2] ?? "00";
  const meridiem = (m[3] ?? "").toLowerCase();
  if (meridiem.startsWith("p") && hour < 12) hour += 12;
  if (meridiem.startsWith("a") && hour === 12) hour = 0;
  if (!meridiem && hour < 8) hour += 12;
  return { time: `${String(hour).padStart(2, "0")}:${minute}`, match: m[0] };
}

function findLocation(text: string): string | null {
  if (/\bzoom\b/i.test(text)) return "Zoom";
  const m = text.match(/\b(?:in|at|@)\s+(?:the\s+)?([A-Z][\w'.&-]*(?:\s+(?:[A-Z][\w'.&-]*|\d+[A-Za-z]?|of|and))*)/);
  if (m && !/^\d/.test(m[1])) return m[1].replace(/[.,!]+$/, "");
  const room = text.match(/\b(?:room|rm\.?)\s*(\w+)/i);
  return room ? `Room ${room[1]}` : null;
}

function findType(lower: string): EventType {
  if (/coffee chat|network|alumni|mixer/.test(lower)) return "networking";
  if (/workshop|resume|case|study|mcat|review|prep|training/.test(lower)) return "workshop";
  if (/info session|recruit|interview|application|deadline|firm visit|career/.test(lower)) return "recruiting";
  if (/gbm|general body|meeting|elections|board/.test(lower)) return "meeting";
  if (/volunteer|service|drive|cleanup/.test(lower)) return "service";
  if (/social|party|night|potluck|run|practice|game|hangout|dinner/.test(lower)) return "social";
  return "other";
}

function findTitle(text: string, cut: string[]): string | null {
  let title = text;
  // Keep only the part before the first date/time/location phrase.
  const lower = title.toLowerCase();
  const positions = cut.map((part) => lower.indexOf(part.toLowerCase())).filter((i) => i > 0);
  const locIdx = lower.search(/\s(?:in|at|@)\s/);
  if (locIdx > 0) positions.push(locIdx);
  if (positions.length) title = title.slice(0, Math.min(...positions));
  title = title
    .replace(/^(hey|hi|hello)\s+(all|everyone|y'all|guys|team)[!,.]*\s*/i, "")
    .replace(/^(reminder|update|heads up|psa)\s*[:\-!]\s*/i, "")
    .replace(/\b(mandatory|required)\b/gi, "")
    .replace(/\b(is|on|this|next|on the|we have|there's|there is)\s*$/i, "")
    .replace(/[^\p{L}\p{N}'&:,\- ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,:\-]+$/, "")
    .trim();
  if (title.length < 3) return null;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function extract(text: string): Extracted {
  const lower = text.toLowerCase();
  const date = findDate(text);
  const time = findTime(text);
  const location = findLocation(text);
  const intent: Extracted["intent"] = /\b(cancel(l)?ed|cancelling|canceled|called off)\b/.test(lower)
    ? "cancel"
    : /\b(update|moved|move[sd]? to|changed|reschedul|pushed|now at|instead)\b/.test(lower)
      ? "update"
      : date || time
        ? "create"
        : "none";
  return {
    intent,
    title: findTitle(text, [date?.match, time?.match].filter(Boolean) as string[]),
    date: date?.date ?? null,
    startTime: time?.time ?? null,
    location,
    type: findType(lower),
    mandatory: /\b(mandatory|required|must attend|attendance is required)\b/.test(lower),
  };
}
