import { addDays, daysUntil, weekdayName } from "./dates";
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
  { id: "e3", clubId: "consulting", title: "Mock case night", offset: 9, startTime: "19:00", location: "Hodges Hall 204", description: null, type: "workshop", mandatory: false },
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
  { id: "e17", clubId: "premed", title: "Hospital volunteering orientation", offset: 7, startTime: "12:00", location: "SF General, Building 5", description: null, type: "service", mandatory: false },
];

export function seedEvents(): { events: Event[]; prefs: Record<string, boolean> } {
  const now = Date.now();
  const prefs: Record<string, boolean> = {};
  const events = SEED.map(({ offset, included, source, ...rest }) => {
    if (included) prefs[rest.id] = true;
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
    { id: "m-old-4", clubId: "running", author: "Sam Ortiz", role: "Captain", text: "great job at the meet everyone!! 🏅", at: t + 1_800_000, result: { kind: "ignored" } },
  ];
}

// The scripted demo: each step is a Slack message plus what Gather extracts from it.
export type ScriptStep = {
  clubId: string;
  author: string;
  role: string;
  text: string;
  action:
    | { kind: "create"; id: string; input: EventInput }
    | { kind: "update"; id: string; patch: Partial<EventInput> }
    | { kind: "cancel"; id: string }
    | { kind: "ignore" };
};

export function demoScript(): ScriptStep[] {
  const bainDay = addDays(2);
  const saturday = addDays(daysUntil(6));
  const gbmDay = addDays(daysUntil(2));
  return [
    {
      clubId: "consulting", author: "Priya Shah", role: "VP Events",
      text: `Coffee chat with Bain alumni ${weekdayName(bainDay)} at 6pm in Hodges 204 ☕ sign-up sheet in thread!`,
      action: { kind: "create", id: "slack-bain", input: { clubId: "consulting", title: "Coffee chat: Bain alumni", date: bainDay, startTime: "18:00", location: "Hodges 204", description: "Sign-up sheet in the Slack thread.", type: "networking", mandatory: false } },
    },
    {
      clubId: "premed", author: "Marcus Lee", role: "Member",
      text: "does anyone have the orgo notes from last week 😭",
      action: { kind: "ignore" },
    },
    {
      clubId: "running", author: "Sam Ortiz", role: "Captain",
      text: `Long run this ${weekdayName(saturday)}! Meet at the Rec Center 8am 🏃`,
      action: { kind: "create", id: "slack-longrun", input: { clubId: "running", title: "Saturday long run", date: saturday, startTime: "08:00", location: "Rec Center", description: null, type: "social", mandatory: false } },
    },
    {
      clubId: "consulting", author: "Priya Shah", role: "VP Events",
      text: "Update: the Bain coffee chat moved to 7pm and it's on Zoom now",
      action: { kind: "update", id: "slack-bain", patch: { startTime: "19:00", location: "Zoom" } },
    },
    {
      clubId: "vsa", author: "Linh Tran", role: "President",
      text: `MANDATORY general body meeting ${weekdayName(gbmDay)} 7pm in the Student Union Ballroom. Officer elections!`,
      action: { kind: "create", id: "slack-vsa-gbm", input: { clubId: "vsa", title: "VSA general body meeting", date: gbmDay, startTime: "19:00", location: "Student Union Ballroom", description: "Officer elections.", type: "meeting", mandatory: true } },
    },
    {
      clubId: "premed", author: "Dana Kim", role: "Secretary",
      text: "Heads up: the UCSF shadowing info session is cancelled, sorry y'all",
      action: { kind: "cancel", id: "e7" },
    },
  ];
}
