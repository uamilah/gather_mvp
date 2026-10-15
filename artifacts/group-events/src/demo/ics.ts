// Export "my calendar" as an .ics file that Google/Apple/Outlook calendars import.
import { clubById } from "./seed";
import type { Event } from "./types";

const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

function stamp(date: string, time: string | null, addHours = 0) {
  const d = new Date(`${date}T${time ?? "09:00"}:00`);
  d.setHours(d.getHours() + addHours);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

export function downloadIcs(events: Event[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gather//Club Calendar//EN"];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@gather.demo`,
      `DTSTART:${stamp(event.date, event.startTime)}`,
      `DTEND:${stamp(event.date, event.startTime, 1)}`,
      `SUMMARY:${esc(`${event.mandatory ? "[Required] " : ""}${event.title}`)}`,
      `LOCATION:${esc(event.location)}`,
      `DESCRIPTION:${esc(`${clubById(event.clubId).name}${event.description ? `\n${event.description}` : ""}`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "my-gather-calendar.ics" });
  a.click();
  URL.revokeObjectURL(url);
}
