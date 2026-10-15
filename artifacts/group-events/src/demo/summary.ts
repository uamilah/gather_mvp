// "AI summary" for the showcase: written from the live event data, so it is
// instant, always accurate, and needs no API key in a public app.
import { addDays, formatDay, formatTime, weekdayName } from "./dates";
import { clubById } from "./seed";
import type { Event } from "./types";

export type Summary = { headline: string; bullets: string[]; count: number; required: number };

export function summarize(events: Event[], scope: "mine" | "all"): Summary {
  const start = addDays(0);
  const end = addDays(7);
  const week = events.filter((event) => event.date >= start && event.date < end).sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  const live = week.filter((event) => !event.cancelled);
  const required = live.filter((event) => event.mandatory);
  const clubs = new Set(live.map((event) => event.clubId));
  const recentChanges = week.filter((event) => event.changes.some((change) => Date.now() - change.at < 86_400_000));

  if (!live.length && !recentChanges.length) {
    return { headline: scope === "mine" ? "Your week is open. Browse the club calendar and add what you want to go to." : "Nothing on the club calendar this week.", bullets: [], count: 0, required: 0 };
  }

  const busiest = Object.entries(live.reduce<Record<string, number>>((acc, event) => ({ ...acc, [event.date]: (acc[event.date] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0];
  const load = live.length >= 5 ? "Busy week" : live.length >= 3 ? "Steady week" : "Light week";
  const headline = `${load}: ${live.length} ${live.length === 1 ? "event" : "events"} across ${clubs.size} ${clubs.size === 1 ? "club" : "clubs"}${required.length ? `, ${required.length} required` : ""}.${busiest && busiest[1] > 1 ? ` ${weekdayName(busiest[0])} is your busiest day.` : ""}`;

  const bullets: string[] = [];
  for (const event of required.slice(0, 2)) {
    bullets.push(`Don't miss ${event.title} (${clubById(event.clubId).short}), ${formatDay(event.date)} at ${formatTime(event.startTime)}. It's required.`);
  }
  for (const event of recentChanges.slice(0, 3)) {
    if (event.cancelled) {
      bullets.push(`${event.title} was cancelled.`);
      continue;
    }
    const last = event.changes.filter((change) => change.field !== "status").slice(-2);
    if (!last.length) continue;
    bullets.push(`${event.title} changed: ${last.map((change) => `${change.field} is now ${change.to}`).join(", ")}.`);
  }
  const prep = live.find((event) => event.type === "recruiting" || event.type === "networking");
  if (prep && bullets.length < 4) bullets.push(`Prep tip: ${prep.title} is ${weekdayName(prep.date)}. Have your resume and a 30-second intro ready.`);
  return { headline, bullets, count: live.length, required: required.length };
}
