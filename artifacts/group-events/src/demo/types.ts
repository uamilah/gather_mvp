export type EventType = "recruiting" | "networking" | "workshop" | "meeting" | "social" | "service" | "other";

export const EVENT_TYPES: EventType[] = ["recruiting", "networking", "workshop", "meeting", "social", "service", "other"];

export type Club = { id: string; name: string; short: string; channel: string; color: string; kind: string };

export type Change = { at: number; field: "time" | "date" | "location" | "status" | "title"; from: string; to: string; via: "slack" | "board" };

export type Event = {
  id: string;
  clubId: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM
  location: string;
  description: string | null;
  type: EventType;
  mandatory: boolean;
  cancelled: boolean;
  source: "slack" | "board";
  sourceMessageId: string | null;
  changes: Change[];
  updatedAt: number;
};

export type EventInput = Pick<Event, "clubId" | "title" | "date" | "startTime" | "location" | "description" | "type" | "mandatory">;

export type SlackMessage = {
  id: string;
  clubId: string;
  author: string;
  role: string;
  text: string;
  at: number;
  // What Gather did with it: created/updated/cancelled an event, or nothing.
  result: { kind: "created" | "updated" | "cancelled"; eventId: string } | null;
};
