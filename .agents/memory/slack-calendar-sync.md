---
name: Slack calendar sync constraints
description: Why Gather uses bounded polling for event extraction rather than a push subscription or message archive.
---

Gather's connected Slack Web API integration does not provide Slack Events API subscriptions. Sync only the selected conversation on a bounded interval, extract event fields, and keep a Slack permalink and source identifiers instead of storing full conversation history.

**Why:** The installed connector supports Web API reads but not Events API delivery, and Slack's real-time search terms prohibit persistent archives of search results.

**How to apply:** Keep polling scoped to the organizer-selected conversation, disclose its delay in the interface, and do not add a message archive or search-result index.
