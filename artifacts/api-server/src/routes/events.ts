import { asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateEventBody,
  CreateEventResponse,
  DeleteEventParams,
  DeleteEventResponse,
  GetEventParams,
  GetEventResponse,
  GetUpcomingSummaryResponse,
  ListCalendarPreferencesParams,
  ListCalendarPreferencesResponse,
  ListEventsResponse,
  SetCalendarPreferenceBody,
  SetCalendarPreferenceParams,
  SetCalendarPreferenceResponse,
  UpdateEventBody,
  UpdateEventParams,
  UpdateEventResponse,
} from "@workspace/api-zod";
import {
  calendarPreferencesTable,
  db,
  eventsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/events", async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(eventsTable)
    .orderBy(asc(eventsTable.date), asc(eventsTable.startTime));

  res.json(ListEventsResponse.parse({ events }));
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [event] = await db
    .insert(eventsTable)
    .values({
      title: parsed.data.title.trim(),
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      location: parsed.data.location.trim() || "Location TBD",
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      mandatory: parsed.data.mandatory,
      source: "board",
    })
    .returning();

  res.status(201).json(CreateEventResponse.parse(event));
});

router.get("/events/:eventId", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, params.data.eventId))
    .limit(1);

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(GetEventResponse.parse(event));
});

router.patch("/events/:eventId", async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const patch: Partial<typeof eventsTable.$inferInsert> = {};
  const data = parsed.data;
  if (data.title !== undefined) patch.title = data.title.trim();
  if (data.date !== undefined) patch.date = data.date;
  if (Object.hasOwn(data, "startTime")) {
    patch.startTime = data.startTime ?? null;
  }
  if (data.location !== undefined) {
    patch.location = data.location.trim() || "Location TBD";
  }
  if (Object.hasOwn(data, "description")) {
    patch.description = data.description ?? null;
  }
  if (data.type !== undefined) patch.type = data.type;
  if (data.mandatory !== undefined) patch.mandatory = data.mandatory;

  let event: typeof eventsTable.$inferSelect | undefined;
  if (Object.keys(patch).length === 0) {
    [event] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, params.data.eventId))
      .limit(1);
  } else {
    patch.updatedAt = new Date();
    [event] = await db
      .update(eventsTable)
      .set(patch)
      .where(eq(eventsTable.id, params.data.eventId))
      .returning();
  }

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(UpdateEventResponse.parse(event));
});

router.delete("/events/:eventId", async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(eventsTable)
    .where(eq(eventsTable.id, params.data.eventId))
    .returning({ id: eventsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(DeleteEventResponse.parse({ deleted: true }));
});

router.get(
  "/calendar-preferences/:memberId",
  async (req, res): Promise<void> => {
    const params = ListCalendarPreferencesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const preferences = await db
      .select()
      .from(calendarPreferencesTable)
      .where(eq(calendarPreferencesTable.memberId, params.data.memberId));

    res.json(ListCalendarPreferencesResponse.parse({ preferences }));
  },
);

router.put(
  "/calendar-preferences/:memberId/:eventId",
  async (req, res): Promise<void> => {
    const params = SetCalendarPreferenceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = SetCalendarPreferenceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [event] = await db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(eq(eventsTable.id, params.data.eventId))
      .limit(1);

    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const [preference] = await db
      .insert(calendarPreferencesTable)
      .values({
        memberId: params.data.memberId,
        eventId: params.data.eventId,
        included: parsed.data.included,
      })
      .onConflictDoUpdate({
        target: [
          calendarPreferencesTable.memberId,
          calendarPreferencesTable.eventId,
        ],
        set: {
          included: parsed.data.included,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(SetCalendarPreferenceResponse.parse(preference));
  },
);

router.get("/summary", async (_req, res): Promise<void> => {
  const start = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const events = await db
    .select()
    .from(eventsTable)
    .orderBy(asc(eventsTable.date), asc(eventsTable.startTime));

  const upcoming = events.filter((event) => event.date >= start && event.date < end);
  const mandatoryCount = upcoming.filter((event) => event.mandatory).length;
  const next = upcoming[0];
  const summary =
    upcoming.length === 0
      ? "No events are planned in the next seven days."
      : `${upcoming.length} event${upcoming.length === 1 ? "" : "s"} in the next seven days, including ${mandatoryCount} required. ${
          next
            ? `Next up: ${next.title} on ${next.date}${next.startTime ? ` at ${next.startTime}` : ""}, ${next.location}.`
            : ""
        }`;

  res.json(
    GetUpcomingSummaryResponse.parse({
      summary,
      aiEnabled: false,
      eventCount: upcoming.length,
      mandatoryCount,
      generatedAt: new Date(),
    }),
  );
});

export default router;
