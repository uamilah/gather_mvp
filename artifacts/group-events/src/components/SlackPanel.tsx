import type { SlackChannel, SlackSettings, SlackSyncResponse } from "@workspace/api-client-react";
import { AlertCircle, Check, ChevronDown, Hash, LockKeyhole, MessageSquareText, RefreshCw, Radio } from "lucide-react";

type Props = {
  channels?: SlackChannel[];
  settings?: SlackSettings;
  connected: boolean;
  loading: boolean;
  saving: boolean;
  syncing: boolean;
  error?: string | null;
  latestSync?: SlackSyncResponse | null;
  onSelect: (channelId: string | null) => void;
  onSync: () => void;
  onRetry: () => void;
};

function since(value: string | null | undefined) {
  if (!value) return "No sync yet";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function SlackPanel({ channels = [], settings, connected, loading, saving, syncing, error, latestSync, onSelect, onSync, onRetry }: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e2ddd2] bg-[#fbfaf6]" data-testid="panel-slack-sync">
      <div className="flex items-center justify-between border-b border-[#eae5da] px-5 py-4">
        <div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8eee8] text-[#43876e]"><MessageSquareText size={16} /></div><div><h2 className="text-sm font-bold">Slack bridge</h2><p className="text-[11px] text-[#7b8088]">Turn plans into events</p></div></div>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${connected ? "bg-[#e3eee8] text-[#34745b]" : "bg-[#f6e9dc] text-[#9c623a]"}`}><span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[#43876e]" : "bg-[#c68a51]"}`} />{connected ? "Connected" : "Not connected"}</span>
      </div>
      <div className="space-y-4 p-5">
        <label className="block text-xs font-bold uppercase tracking-wide text-[#727984]">Listen to channel
          <span className="relative mt-2 block">
            <Hash size={15} className="pointer-events-none absolute left-3 top-3 text-[#828993]" />
            <select value={settings?.selectedChannel?.id ?? ""} onChange={(e) => onSelect(e.target.value || null)} disabled={!connected || loading || saving} className="w-full appearance-none rounded-lg border border-[#dcd8ce] bg-white py-2.5 pl-9 pr-9 text-sm font-medium text-[#252c41] outline-none focus:border-[#43876e] disabled:opacity-60" data-testid="select-slack-channel">
              <option value="">Choose a channel</option>
              {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.isPrivate ? "Private · " : ""}#{channel.name}</option>)}
            </select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-[#777d86]" />
          </span>
        </label>
        {!connected && <p className="rounded-lg bg-[#f6e9dc] px-3 py-2.5 text-xs leading-5 text-[#89572f]">Slack is not connected for this workspace. Events can still be managed here.</p>}
        {connected && !channels.length && !loading && <p className="text-xs text-[#777d86]">No available conversations were returned by Slack.</p>}
        <div className="flex items-center justify-between rounded-lg bg-[#f3f1e9] px-3.5 py-3">
          <div className="flex items-center gap-2.5"><Radio size={15} className="text-[#43876e]" /><div><p className="text-xs font-semibold text-[#373e51]">Auto-check every {settings?.pollSeconds ?? "—"} sec</p><p className="mt-0.5 text-[10px] text-[#7e8389]">Latest check · {since(settings?.lastSyncAt)}</p></div></div>
          <button onClick={onSync} disabled={!settings?.selectedChannel || syncing || !connected} className="flex h-8 items-center gap-1.5 rounded-lg bg-[#43876e] px-3 text-xs font-bold text-white transition hover:bg-[#34745b] disabled:cursor-not-allowed disabled:bg-[#c4c9c4]" data-testid="button-sync-slack"><RefreshCw size={13} className={syncing ? "animate-spin" : ""} />{syncing ? "Checking" : "Sync now"}</button>
        </div>
        {settings?.selectedChannel && <p className="flex items-center gap-1.5 text-[11px] text-[#777d86]"><LockKeyhole size={12} />Monitoring <strong className="font-semibold text-[#454c5b]">#{settings.selectedChannel.name}</strong></p>}
        {error && <div className="flex items-start gap-2 rounded-lg border border-[#f0d0c9] bg-[#fbefeb] p-3 text-xs leading-5 text-[#9d4b40]" role="alert" data-testid="status-slack-error"><AlertCircle size={15} className="mt-0.5 shrink-0" /><div><strong className="font-bold">Slack reported an issue.</strong><br />{error}<button className="ml-1 underline underline-offset-2" onClick={onRetry} data-testid="button-retry-slack">Retry</button></div></div>}
        {latestSync && <div className="flex items-start gap-2 rounded-lg border border-[#cfe2d6] bg-[#edf5ef] p-3 text-xs text-[#37654f]" role="status" data-testid="status-sync-result"><Check size={15} className="mt-0.5 shrink-0" /><div><strong>{latestSync.message}</strong><p className="mt-1 text-[11px]">{latestSync.imported} imported · {latestSync.updated} updated · {latestSync.ignored} skipped</p></div></div>}
        <div className="flex justify-between border-t border-[#eae5da] pt-3 text-[10px] text-[#92958f]"><span>Channel selection is shared with the club</span><span className="mono-font">SYNC / {since(settings?.lastSyncAt)}</span></div>
      </div>
    </section>
  );
}
