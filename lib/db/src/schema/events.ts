import {
  boolean,
  date,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const eventsTable = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    startTime: text("start_time"),
    location: text("location").notNull().default("Location TBD"),
    description: text("description"),
    type: text("type").notNull().default("other"),
    mandatory: boolean("mandatory").notNull().default(false),
    source: text("source").notNull().default("board"),
    sourceChannelId: text("source_channel_id"),
    sourceChannelName: text("source_channel_name"),
    sourceMessageTs: text("source_message_ts"),
    sourcePermalink: text("source_permalink"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("events_slack_source_unique").on(
      table.sourceChannelId,
      table.sourceMessageTs,
    ),
  ],
);

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEvent = typeof eventsTable.$inferInsert;
export type Event = typeof eventsTable.$inferSelect;

export const calendarPreferencesTable = pgTable(
  "calendar_preferences",
  {
    memberId: text("member_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    included: boolean("included").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.eventId] })],
);

export const insertCalendarPreferenceSchema = createInsertSchema(
  calendarPreferencesTable,
).omit({ updatedAt: true });

export type InsertCalendarPreference =
  typeof calendarPreferencesTable.$inferInsert;
export type CalendarPreference = typeof calendarPreferencesTable.$inferSelect;

export const slackSettingsTable = pgTable("slack_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  selectedChannelId: text("selected_channel_id"),
  selectedChannelName: text("selected_channel_name"),
  selectedChannelType: text("selected_channel_type"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  error: text("error"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSlackSettingsSchema = createInsertSchema(
  slackSettingsTable,
).omit({ id: true, updatedAt: true });

export type InsertSlackSettings = typeof slackSettingsTable.$inferInsert;
export type SlackSettingsRow = typeof slackSettingsTable.$inferSelect;
