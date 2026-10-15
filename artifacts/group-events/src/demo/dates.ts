// All demo dates are relative to "today" so the showcase never looks stale.

export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(offset: number, from = today()) {
  const d = new Date(from);
  d.setDate(d.getDate() + offset);
  return iso(d);
}

export function parseIso(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function weekdayName(value: string) {
  return new Intl.DateTimeFormat("en", { weekday: "long" }).format(parseIso(value));
}

export function formatTime(value: string | null) {
  if (!value) return "Time TBA";
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(`2000-01-01T${value}`));
}

export function formatDay(value: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en", opts).format(parseIso(value));
}

// Days until the next given weekday (0 = Sunday), always 1..7.
export function daysUntil(weekday: number, from = today()) {
  const diff = (weekday - from.getDay() + 7) % 7;
  return diff === 0 ? 7 : diff;
}
