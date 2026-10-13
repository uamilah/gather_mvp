import { Router, type IRouter } from "express";
import {
  GetSlackSettingsResponse,
  ListSlackChannelsResponse,
  SaveSlackSettingsBody,
  SaveSlackSettingsResponse,
  SyncSlackConversationBody,
  SyncSlackConversationResponse,
} from "@workspace/api-zod";
import {
  getSlackSettings,
  listSlackChannels,
  saveSlackChannel,
  SlackApiError,
  syncSlackConversation,
} from "../lib/slack-events";

const router: IRouter = Router();

function getErrorCode(error: unknown): string {
  return error instanceof SlackApiError ? error.slackCode : "request_failed";
}

router.get("/slack/channels", async (req, res): Promise<void> => {
  try {
    const channels = await listSlackChannels();
    res.json(
      ListSlackChannelsResponse.parse({
        connected: true,
        channels,
        error: null,
      }),
    );
  } catch (error) {
    const code = getErrorCode(error);
    req.log.warn({ code }, "Slack conversation list failed");
    res.json(
      ListSlackChannelsResponse.parse({
        connected: false,
        channels: [],
        error: code,
      }),
    );
  }
});

router.get("/slack/settings", async (_req, res): Promise<void> => {
  const settings = await getSlackSettings();
  res.json(GetSlackSettingsResponse.parse(settings));
});

router.put("/slack/settings", async (req, res): Promise<void> => {
  const parsed = SaveSlackSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    const settings = await getSlackSettings();
    res.json(
      SaveSlackSettingsResponse.parse({
        ...settings,
        error: "invalid_settings",
      }),
    );
    return;
  }

  try {
    const settings = await saveSlackChannel(parsed.data.channelId);
    res.json(SaveSlackSettingsResponse.parse(settings));
  } catch (error) {
    const code = getErrorCode(error);
    req.log.warn({ code }, "Slack conversation selection failed");
    const settings = await getSlackSettings();
    res.json(SaveSlackSettingsResponse.parse({ ...settings, error: code }));
  }
});

router.post("/slack/sync", async (req, res): Promise<void> => {
  const parsed = SyncSlackConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const settings = await getSlackSettings();
    if (settings.selectedChannel?.id !== parsed.data.channelId) {
      res.json(
        SyncSlackConversationResponse.parse({
          imported: 0,
          updated: 0,
          ignored: 0,
          checkedAt: new Date(),
          message: "Select this Slack conversation before syncing it.",
        }),
      );
      return;
    }

    const result = await syncSlackConversation(parsed.data.channelId);
    res.json(SyncSlackConversationResponse.parse(result));
  } catch (error) {
    const code = getErrorCode(error);
    req.log.warn({ code }, "Slack conversation sync failed");
    res.json(
      SyncSlackConversationResponse.parse({
        imported: 0,
        updated: 0,
        ignored: 0,
        checkedAt: new Date(),
        message: `Slack sync failed: ${code}.`,
      }),
    );
  }
});

export default router;
