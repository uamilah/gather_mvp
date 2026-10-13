import type { UpcomingSummary } from "@workspace/api-client-react";
import { CalendarClock, Sparkles } from "lucide-react";

type Props = { summary?: UpcomingSummary; loading: boolean; error: boolean; onRetry: () => void };

export function UpcomingPanel({ summary, loading, error, onRetry }: Props) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#252c41] p-5 text-[#f5f1e7]" data-testid="panel-upcoming-summary">
      <div className="absolute -right-7 -top-10 h-36 w-36 rounded-full border border-[#ffffff]/10" /><div className="absolute -right-1 -top-1 h-24 w-24 rounded-full border border-[#ffffff]/10" />
      <div className="relative">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><CalendarClock size={16} className="text-[#a1d2b6]" /><p className="mono-font text-[10px] font-semibold uppercase tracking-[.16em] text-[#c4cbbb]">Next seven days</p></div>{summary?.aiEnabled && <Sparkles size={15} className="text-[#f0ae86]" />}</div>
        {loading ? <div className="mt-5 space-y-2"><div className="h-4 w-4/5 animate-pulse rounded bg-white/10" /><div className="h-4 w-3/5 animate-pulse rounded bg-white/10" /><div className="h-4 w-2/3 animate-pulse rounded bg-white/10" /></div> : error ? <div className="mt-4 text-sm text-[#d7d7cf]"><p>Upcoming snapshot could not load.</p><button onClick={onRetry} className="mt-2 text-xs font-bold text-[#a1d2b6] underline underline-offset-2" data-testid="button-retry-summary">Try again</button></div> : (
          <>
            <p className="display-font mt-4 text-[17px] font-semibold leading-6 text-[#fffdf5]" data-testid="text-upcoming-summary">{summary?.summary || "Nothing on the horizon yet. Add a date and the week will take shape."}</p>
            <div className="mt-5 flex items-end justify-between border-t border-white/15 pt-4">
              <div><span className="display-font text-3xl font-bold">{summary?.eventCount ?? 0}</span><span className="ml-2 text-xs text-[#c4cbbb]">events ahead</span></div>
              <div className="text-right"><span className="display-font text-2xl font-bold text-[#f0ae86]">{summary?.mandatoryCount ?? 0}</span><p className="text-[10px] uppercase tracking-wider text-[#c4cbbb]">required</p></div>
            </div>
            {!summary?.aiEnabled && <p className="mt-3 border-t border-white/10 pt-3 text-[10px] leading-4 text-[#c4cbbb]">AI summary is unavailable. The event count and schedule remain current.</p>}
          </>
        )}
      </div>
    </section>
  );
}
