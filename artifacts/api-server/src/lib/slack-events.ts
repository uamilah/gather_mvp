import { and, eq } from "drizzle-orm";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { db, eventsTable, slackSettingsTable } from "@workspace/db";

const SETTINGS_ID = "11111111-1111-4111-8111-111111111111";
const POLL_SECONDS = 60;
const EVENT_HINT =
  /\b(meet(?:ing)?|gather(?:ing)?|hangout|party|lunch|dinner|event|study group|rehearsal|workshop|volunteer|cleanup|fundraiser|deadline|ceremony|conference|trip|retreat|practice|session)\b/i;

type ConversationType =
  | "public_channel"
  | "private_channel"
  | "group_dm"
  | "direct_message";

export interface SlackChannel {
  id: string;
  name: string;
  type: ConversationType;
  isPrivate: boolean;
}

interface SlackConversation {
  id?: string;
  name?: string;
  is_private?: boolean;
  is_mpim?: boolean;
  is_im?: boolean;
  is_archived?: boolean;
}

interface SlackMessage {
  ts?: string;
  text?: string;
  subtype?: string;
}

interface SlackApiResult<T> {
  ok?: boolean;
  error?: string;
  channels?: T;
  messages?: T;
  permalink?: string;
}

export class SlackApiError extends Error {
  readonly slackCode: string;

  constructor(code: string) {
    super(`Slack API request failed (${code}).`);
    this.name = "SlackApiError";
    this.slackCode = code;
  }
}

async function callSlack<T>(path: string): Promise<SlackApiResult<T>> {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("slack", path, { method: "GET" });
  let payload: SlackApiResult<T>;

  try {
    payload = (await response.json()) as SlackApiResult<T>;
  } catch {
    throw new SlackApiError("invalid_response");
  }

  if (!response.ok || payload.ok !== true) {
    throw new SlackApiError(payload.error ?? `http_${response.status}`);
  }

  return payload;
}

function getConversationType(conversation: SlackConversation): ConversationType {
  if (conversation.is_mpim) return "group_dm";
  if (conversation.is_im) return "direct_message";
  return conversation.is_private ? "private_channel" : "public_channel";
}

export async function listSlackChannels(): Promise<SlackChannel[]> {
  const params = new URLSearchParams({
    types: "public_channel,private_channel,mpim",
    limit: "200",
    exclude_archived: "true",
  });
  const result = await callSlack<SlackConversation[]>(
    `/conversations.list?${params.toString()}`,
  );

  return (result.channels ?? [])
    .filter((item): item is SlackConversation & { id: string } => Boolean(item.id))
    .map((conversation) => ({
      id: conversation.id,
      name:
        conversation.name ??
        (conversation.is_mpim ? "Group direct message" : "Private conversation"),
      type: getConversationType(conversation),
      isPrivate: Boolean(conversation.is_private || conversation.is_mpim),
    }));
}

export interface SlackSettings {
  selectedChannel: SlackChannel | null;
  lastSyncAt: Date | null;
  pollSeconds: number;
  error: string | null;
}

async function getSettingsRow() {
  const [row] = await db
    .select()
    .from(slackSettingsTable)
    .where(eq(slackSettingsTable.id, SETTINGS_ID))
    .limit(1);
  return row;
}

export async function getSlackSettings(): Promise<SlackSettings> {
  const row = await getSettingsRow();
  const selectedChannel =
    row?.selectedChannelId && row.selectedChannelName && row.selectedChannelType
      ? {
          id: row.selectedChannelId,
          name: row.selectedChannelName,
          type: row.selectedChannelType as ConversationType,
          isPrivate:
            row.selectedChannelType === "private_channel" ||
            row.selectedChannelType === "group_dm",
        }
      : null;

  return {
    selectedChannel,
    lastSyncAt: row?.lastSyncAt ?? null,
    pollSeconds: POLL_SECONDS,
    error: row?.error ?? null,
  };
}

export async function saveSlackChannel(
  channelId: string | null,
): Promise<SlackSettings> {
  let selectedChannel: SlackChannel | null = null;
  if (channelId) {
    const availableChannels = await listSlackChannels();
    selectedChannel =
      availableChannels.find((channel) => channel.id === channelId) ?? null;
    if (!selectedChannel) {
      throw new SlackApiError("conversation_not_available");
    }
  }

  const current = await getSettingsRow();
  const values = {
    selectedChannelId: selectedChannel?.id ?? null,
    selectedChannelName: selectedChannel?.name ?? null,
    selectedChannelType: selectedChannel?.type ?? null,
    lastSyncAt: channelId === current?.selectedChannelId ? current.lastSyncAt : null,
    error: null,
    updatedAt: new Date(),
  };

  await db
    .insert(slackSettingsTable)
    .values({ id: SETTINGS_ID, ...values })
    .onConflictDoUpdate({
      target: slackSettingsTable.id,
      set: values,
    });

  return getSlackSettings();
}

interface ExtractedEvent {
  title: string;
  date: string;
  startTime: string | null;
  location: string;
  type: "meeting" | "social" | "service" | "deadline" | "fundraiser" | "other";
  mandatory: boolean;
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function validDate(year: number, month: number, day: number): Date | null {
  const result = new Date(Date.UTC(year, month - 1, day));
  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    return null;
  }
  return result;
}

function nextDateWithMonthDay(
  month: number,
  day: number,
  referenceDate: Date,
  explicitYear?: number,
): Date | null {
  const year = explicitYear ?? referenceDate.getUTCFullYear();
  let result = validDate(year, month, day);
  if (
    result &&
    explicitYear === undefined &&
    result < new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()))
  ) {
    result = validDate(year + 1, month, day);
  }
  return result;
}

function parseEventDate(text: string, messageTs: string): string | null {
  const timestamp = Number(messageTs);
  const messageDate = Number.isFinite(timestamp)
    ? new Date(timestamp * 1000)
    : new Date();
  const referenceDate = new Date(
    Date.UTC(
      messageDate.getUTCFullYear(),
      messageDate.getUTCMonth(),
      messageDate.getUTCDate(),
    ),
  );

  const isoDate = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoDate) {
    const parsed = validDate(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));
    return parsed?.toISOString().slice(0, 10) ?? null;
  }

  const monthNames =
    "january february march april may june july august september october november december".split(
      " ",
    );
  const monthName = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s+(20\d{2}))?\b/i,
  );
  if (monthName) {
    const month = monthNames.indexOf(monthName[1].toLowerCase()) + 1;
    const parsed = nextDateWithMonthDay(
      month,
      Number(monthName[2]),
      referenceDate,
      monthName[3] ? Number(monthName[3]) : undefined,
    );
    return parsed?.toISOString().slice(0, 10) ?? null;
  }

  const numericDate = text.match(
    /\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])(?:[/-](\d{2,4}))?\b/,
  );
  if (numericDate) {
    const rawYear = numericDate[3];
    const year = rawYear
      ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear)
      : undefined;
    const parsed = nextDateWithMonthDay(
      Number(numericDate[1]),
      Number(numericDate[2]),
      referenceDate,
      year,
    );
    return parsed?.toISOString().slice(0, 10) ?? null;
  }

  if (/\btomorrow\b/i.test(text)) {
    return addUtcDays(referenceDate, 1).toISOString().slice(0, 10);
  }
  if (/\btoday\b/i.test(text)) {
    return referenceDate.toISOString().slice(0, 10);
  }

  const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const weekdayMatch = text.match(
    /\b(?:next|this)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (weekdayMatch) {
    const target = weekdayNames.indexOf(weekdayMatch[1].toLowerCase());
    let offset = (target - referenceDate.getUTCDay() + 7) % 7;
    if (offset === 0 || /\bnext\b/i.test(weekdayMatch[0])) offset += 7;
    return addUtcDays(referenceDate, offset).toISOString().slice(0, 10);
  }

  return null;
}

function parseEventTime(text: string): string | null {
  const twelveHour = text.match(
    /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i,
  );
  if (twelveHour) {
    let hour = Number(twelveHour[1]) % 12;
    if (twelveHour[3].toLowerCase().startsWith("p")) hour += 12;
    return `${String(hour).padStart(2, "0")}:${twelveHour[2] ?? "00"}`;
  }

  const twentyFourHour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourHour) {
    return `${String(Number(twentyFourHour[1])).padStart(2, "0")}:${twentyFourHour[2]}`;
  }

  if (/\bnoon\b/i.test(text)) return "12:00";
  if (/\bmidnight\b/i.test(text)) return "00:00";
  return null;
}

function parseEventLocation(text: string): string {
  const matches = text.matchAll(
    /\b(?:at|location:?)\s+((?:the\s+)?[a-zA-Z0-9#][\w'’&-]*(?:\s+[a-zA-Z0-9#][\w'’&-]*){0,5})/gi,
  );
  for (const match of matches) {
    const location = match[1]
      .replace(/[.!?,;:]+$/, "")
      .replace(/\s+(?:on|tomorrow|today|next)\b.*$/i, "")
      .trim();
    if (!/^\d{1,2}(?::\d{2})?$/.test(location)) {
      return location.slice(0, 240);
    }
  }
  return "Location TBD";
}

function classifyEvent(text: string): ExtractedEvent["type"] {
  if (/\bfundrais(?:er|ing)\b/i.test(text)) return "fundraiser";
  if (/\b(volunteer|service|cleanup|clean-up|community work)\b/i.test(text)) {
    return "service";
  }
  if (/\b(deadline|due date|submit|submission)\b/i.test(text)) return "deadline";
  if (/\b(party|hangout|lunch|dinner|picnic|celebration|social)\b/i.test(text)) {
    return "social";
  }
  if (/\b(meet(?:ing)?|study group|rehearsal|workshop|practice|session)\b/i.test(text)) {
    return "meeting";
  }
  return "other";
}

function extractEvent(text: string, messageTs: string): ExtractedEvent | null {
  if (!EVENT_HINT.test(text)) return null;

  const date = parseEventDate(text, messageTs);
  if (!date) return null;

  const firstLine = text
    .split(/\r?\n/)[0]
    .replace(/<@[A-Z0-9]+>/g, "")
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, "$1")
    .replace(/<https?:\/\/[^>]+>/g, "")
    .trim();
  const title = firstLine.length > 180 ? `${firstLine.slice(0, 177).trim()}…` : firstLine;

  return {
    title: title || `Group event on ${date}`,
    date,
    startTime: parseEventTime(text),
    location: parseEventLocation(text),
    type: classifyEvent(text),
    mandatory: /\b(mandatory|required|everyone must|all members|attendance required)\b/i.test(
      text,
    ),
  };
}

interface SlackEventSyncResult {
  imported: number;
  updated: number;
  ignored: number;
  checkedAt: Date;
  message: string;
}

const activeSyncs = new Map<string, Promise<SlackEventSyncResult>>();

async function updateLastSync(
  channelId: string,
  checkedAt: Date,
  error: string | null,
): Promise<void> {
  const [row] = await db
    .select({ id: slackSettingsTable.id })
    .from(slackSettingsTable)
    .where(eq(slackSettingsTable.id, SETTINGS_ID))
    .limit(1);
  if (!row) return;
  await db
    .update(slackSettingsTable)
    .set({
      lastSyncAt: checkedAt,
      error,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(slackSettingsTable.id, SETTINGS_ID),
        eq(slackSettingsTable.selectedChannelId, channelId),
      ),
    );
}

async function syncConversation(channelId: string): Promise<SlackEventSyncResult> {
  const existingSync = activeSyncs.get(channelId);
  if (existingSync) return existingSync;

  const syncPromise = (async (): Promise<SlackEventSyncResult> => {
    const checkedAt = new Date();
    try {
      const params = new URLSearchParams({ channel: channelId, limit: "100" });
      const response = await callSlack<SlackMessage[]>(
        `/conversations.history?${params.toString()}`,
      );
      const messages = response.messages ?? [];
      const channel = (await listSlackChannels()).find(
        (item) => item.id === channelId,
      );
      let imported = 0;
      let updated = 0;
      let ignored = 0;

      for (const message of messages) {
        if (
          !message.ts ||
          !message.text ||
          message.subtype === "message_deleted" ||
          message.subtype === "channel_join" ||
          message.subtype === "channel_leave"
        ) {
          ignored += 1;
          continue;
        }

        const parsed = extractEvent(message.text, message.ts);
        if (!parsed) {
          ignored += 1;
          continue;
        }

        const [existing] = await db
          .select()
          .from(eventsTable)
          .where(
            and(
              eq(eventsTable.sourceChannelId, channelId),
              eq(eventsTable.sourceMessageTs, message.ts),
            ),
          )
          .limit(1);

        if (existing) {
          const changed =
            existing.title !== parsed.title ||
            existing.date !== parsed.date ||
            existing.startTime !== parsed.startTime ||
            existing.location !== parsed.location ||
            existing.type !== parsed.type ||
            existing.mandatory !== parsed.mandatory;
          if (changed) {
            await db
              .update(eventsTable)
              .set({
                ...parsed,
                updatedAt: new Date(),
              })
              .where(eq(eventsTable.id, existing.id));
            updated += 1;
          } else {
            ignored += 1;
          }
          continue;
        }

        let sourcePermalink: string | null = null;
        try {
          const permalinkParams = new URLSearchParams({
            channel: channelId,
            message_ts: message.ts,
          });
          const permalinkResult = await callSlack<never>(
            `/chat.getPermalink?${permalinkParams.toString()}`,
          );
          sourcePermalink = permalinkResult.permalink ?? null;
        } catch {
          // The event remains useful if Slack cannot return a source link.
        }

        await db.insert(eventsTable).values({
          ...parsed,
          source: "slack",
          sourceChannelId: channelId,
          sourceChannelName: channel?.name ?? "Slack conversation",
          sourceMessageTs: message.ts,
          sourcePermalink,
        });
        imported += 1;
      }

      await updateLastSync(channelId, checkedAt, null);
      return {
        imported,
        updated,
        ignored,
        checkedAt,
        message: `Checked ${messages.length} recent messages. ${imported} new event${imported === 1 ? "" : "s"} and ${updated} update${updated === 1 ? "" : "s"}.`,
      };
    } catch (error) {
      const slackCode =
        error instanceof SlackApiError ? error.slackCode : "request_failed";
      await updateLastSync(channelId, checkedAt, slackCode).catch(() => undefined);
      throw error;
    }
  })();

  activeSyncs.set(channelId, syncPromise);
  try {
    return await syncPromise;
  } finally {
    activeSyncs.delete(channelId);
  }
}

export function syncSlackConversation(
  channelId: string,
): Promise<SlackEventSyncResult> {
  return syncConversation(channelId);
}

export async function syncConfiguredSlackConversation(): Promise<void> {
  const settings = await getSlackSettings();
  if (!settings.selectedChannel) return;
  await syncConversation(settings.selectedChannel.id);
}

let pollingStarted = false;

export function startSlackAutoSync(): void {
  if (pollingStarted) return;
  pollingStarted = true;
  const timer = setInterval(() => {
    void syncConfiguredSlackConversation().catch(() => {
      // Errors are persisted in Slack settings and shown in the UI.
    });
  }, POLL_SECONDS * 1000);
  timer.unref();
}
