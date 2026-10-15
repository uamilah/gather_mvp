import type { EventType } from "./types";

export const TYPE_STYLE: Record<EventType, { label: string; bg: string; fg: string; dot: string }> = {
  recruiting: { label: "Recruiting", bg: "#e1e9f5", fg: "#2f5f9e", dot: "#3d6fb6" },
  networking: { label: "Networking", bg: "#e1edf1", fg: "#2f6f80", dot: "#3d8aa0" },
  workshop: { label: "Workshop", bg: "#f4e8c9", fg: "#7f6118", dot: "#c79a2a" },
  meeting: { label: "Meeting", bg: "#e3eee8", fg: "#2f6b53", dot: "#43876e" },
  social: { label: "Social", bg: "#f7e3d8", fg: "#9c5234", dot: "#d9825b" },
  service: { label: "Service", bg: "#ece5f1", fg: "#64508a", dot: "#8a6db5" },
  other: { label: "Other", bg: "#ecebe5", fg: "#5f646a", dot: "#9a9d9f" },
};

export const REQUIRED = { bg: "#f7e4df", fg: "#a14c42", border: "#c8574a" };
