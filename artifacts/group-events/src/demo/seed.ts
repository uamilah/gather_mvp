import { addDays, weekdayName } from "./dates";
import type { Club, Event, EventInput, SlackMessage } from "./types";

export const CLUBS: Club[] = [
  { id: "consulting", name: "Consulting Club", short: "Consulting", channel: "consulting-club", color: "#2f5f9e", kind: "Pre-professional" },
  { id: "premed", name: "Pre-Med Society", short: "Pre-Med", channel: "premed", color: "#b0503f", kind: "Pre-professional" },
  { id: "vsa", name: "Vietnamese Student Assoc.", short: "VSA", channel: "vsa-general", color: "#c27a1a", kind: "Cultural" },
  { id: "running", name: "Club Running", short: "Running", channel: "club-running", color: "#3f7f5f", kind: "Sports" },
];

export const clubById = (id: string) => CLUBS.find((club) => club.id === id) ?? CLUBS[0];

type SeedEvent = Omit<EventInput, "date"> & { id: string; offset: number; source?: "slack" | "board"; included?: boolean };

const SEED: SeedEvent[] = [
  { id: "e1", clubId: "consulting", title: "Case interview workshop", offset: -3, startTime: "18:30", location: "Hodges Hall 204", description: "Bring a pen. We'll run two market-sizing cases in pairs.", type: "workshop", mandatory: false, included: true },
  { id: "e2", clubId: "consulting", title: "Deloitte firm visit", offset: 5, startTime: "14:00", location: "Deloitte SF office", description: "Business casual. Meet in the lobby at 1:45.", type: "recruiting", mandatory: false, included: true },
  { id: "e3", clubId: "consulting", title: "Mock case night", offset: 9, included: false, startTime: "19:00", location: "Hodges Hall 204", description: null, type: "workshop", mandatory: false },
  { id: "e4", clubId: "consulting", title: "Consulting Club GBM", offset: 16, startTime: "19:00", location: "Student Union 310", description: "Recruiting season kickoff and new member intros.", type: "meeting", mandatory: true },
  { id: "e5", clubId: "consulting", title: "McKinsey resume drop deadline", offset: 22, startTime: "23:59", location: "Online", description: "Upload through the careers portal. Get a resume review first!", type: "recruiting", mandatory: false },
  { id: "e6", clubId: "premed", title: "MCAT study group", offset: 2, startTime: "17:00", location: "Library, 3rd floor", description: "This week: biochem. Bring practice question sets.", type: "workshop", mandatory: false, included: true },
  { id: "e7", clubId: "premed", title: "Shadowing info session: UCSF Health", offset: 4, startTime: "18:00", location: "Life Sciences 1001", description: null, type: "recruiting", mandatory: false, source: "slack", included: true },
  { id: "e8", clubId: "premed", title: "Med school admissions panel", offset: 11, startTime: "19:00", location: "Life Sciences 1001", description: "Panel with admissions officers from three med schools.", type: "meeting", mandatory: true },
  { id: "e9", clubId: "premed", title: "Blood drive volunteering", offset: 18, startTime: "10:00", location: "Rec Center", description: "Two-hour shifts, sign up in the sheet.", type: "service", mandatory: false },
  { id: "e10", clubId: "vsa", title: "Pho night social", offset: 3, startTime: "19:00", location: "Multicultural Center", description: "Free food, bring a friend.", type: "social", mandatory: false, source: "slack" },
  { id: "e11", clubId: "vsa", title: "Culture show rehearsal", offset: 10, startTime: "18:00", location: "Main Theater", description: "All performers required.", type: "meeting", mandatory: true },
  { id: "e12", clubId: "vsa", title: "Culture show", offset: 24, startTime: "19:00", location: "Main Theater", description: "Tickets on sale next week.", type: "social", mandatory: false, included: true },
  { id: "e13", clubId: "running", title: "Track workout", offset: 1, startTime: "07:00", location: "Kezar Stadium track", description: "8 x 400m. All paces welcome.", type: "social", mandatory: false },
  { id: "e14", clubId: "running", title: "Trail run, Lands End", offset: 13, startTime: "09:00", location: "Lands End trailhead", description: null, type: "social", mandatory: false },
  { id: "e15", clubId: "running", title: "Bay Area Invitational", offset: 20, startTime: "08:00", location: "Crystal Springs", description: "Race day. Carpools leave at 6:30.", type: "other", mandatory: false },
  { id: "e16", clubId: "consulting", title: "Coffee chat: alumni at BCG", offset: -1, startTime: "16:00", location: "Peet's on campus", description: null, type: "networking", mandatory: false, source: "slack" },
  { id: "e17", clubId: "premed", title: "Hospital volunteering orientation", offset: 7, included: false, startTime: "12:00", location: "SF General, Building 5", description: null, type: "service", mandatory: false },
];

export function seedEvents(): { events: Event[]; prefs: Record<string, boolean> } {
  const now = Date.now();
  const prefs: Record<string, boolean> = {};
  const events = SEED.map(({ offset, included, source, ...rest }) => {
    if (included !== undefined) prefs[rest.id] = included;
    return { ...rest, date: addDays(offset), cancelled: false, source: source ?? "board", sourceMessageId: null, changes: [], updatedAt: now - 86_400_000 } satisfies Event;
  });
  return { events, prefs };
}

export function seedMessages(): SlackMessage[] {
  const t = Date.now() - 3_600_000 * 20;
  return [
    { id: "m-old-1", clubId: "consulting", author: "Priya Shah", role: "VP Events", text: "Reminder that BCG alumni coffee chat is tomorrow 4pm at Peet's!", at: t, result: { kind: "created", eventId: "e16" } },
    { id: "m-old-2", clubId: "premed", author: "Dana Kim", role: "Secretary", text: `Shadowing info session with UCSF Health on ${weekdayName(addDays(4))} at 6pm, Life Sciences 1001`, at: t + 600_000, result: { kind: "created", eventId: "e7" } },
    { id: "m-old-3", clubId: "vsa", author: "Linh Tran", role: "President", text: `Pho night ${weekdayName(addDays(3))} 7pm at the Multicultural Center 🍜 bring a friend`, at: t + 1_200_000, result: { kind: "created", eventId: "e10" } },
    { id: "m-old-4", clubId: "running", author: "Sam Ortiz", role: "Captain", text: "great job at the meet everyone!! 🏅", at: t + 1_800_000, result: null },
  ];
}

// The club members the AI plays in each channel.
export const PEOPLE: Record<string, { name: string; role: string; vibe: string; color: string }[]> = {
  consulting: [
    { name: "Priya Shah", role: "VP Events", vibe: "organized, decisive, books rooms and sets times", color: "#6d5bd0" },
    { name: "Jordan Wells", role: "Member", vibe: "junior, eager about recruiting season, a little anxious", color: "#2f6f80" },
  ],
  premed: [
    { name: "Dana Kim", role: "Secretary", vibe: "careful with logistics, reminds people about details", color: "#b0503f" },
    { name: "Marcus Lee", role: "Member", vibe: "funny, perpetually stressed about orgo", color: "#3f7f9a" },
  ],
  vsa: [
    { name: "Linh Tran", role: "President", vibe: "warm hype person, loves big group events", color: "#c27a1a" },
    { name: "Kevin Pham", role: "Member", vibe: "foodie, always suggests where to eat", color: "#8a6db5" },
  ],
  running: [
    { name: "Sam Ortiz", role: "Captain", vibe: "high energy, early mornings, sets meet points", color: "#3f7f5f" },
    { name: "Ava Chen", role: "Member", vibe: "chill, asks about pace groups and carpools", color: "#d9825b" },
  ],
};

export function personColor(name: string) {
  if (name === "You") return "#252c41";
  for (const list of Object.values(PEOPLE)) for (const p of list) if (p.name === name) return p.color;
  return "#616061";
}
