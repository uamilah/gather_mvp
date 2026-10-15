import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { Summary } from "@/demo/summary";

type Props = { summary: Summary; scope: "mine" | "all"; loading: boolean; source: "ai" | "builtin" };

export function UpcomingPanel({ summary, scope, loading, source }: Props) {
  // A short "thinking" beat whenever the summary changes, so updates read as live.
  const signature = summary.headline + summary.bullets.join("|");
  const [thinking, setThinking] = useState(false);
  useEffect(() => {
    setThinking(true);
    const timer = window.setTimeout(() => setThinking(false), 650);
    return () => window.clearTimeout(timer);
  }, [signature]);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#252c41] p-5 text-[#f5f1e7]" data-testid="panel-upcoming-summary">
      <div className="absolute -right-7 -top-10 h-36 w-36 rounded-full border border-white/10" /><div className="absolute -right-1 -top-1 h-24 w-24 rounded-full border border-white/10" />
      <div className="relative">
        <div className="flex items-center gap-2"><Sparkles size={15} className="text-[#f0ae86]" /><p className="mono-font min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[#c4cbbb]">AI summary · next 7 days{scope === "mine" ? " · your calendar" : " · your clubs"}</p><span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#c4cbbb]">{source === "ai" ? "Live AI" : "Built-in"}</span></div>
        {thinking || loading ? (
          <div className="mt-4 space-y-2"><div className="h-4 w-4/5 animate-pulse rounded bg-white/10" /><div className="h-4 w-3/5 animate-pulse rounded bg-white/10" /><div className="h-4 w-2/3 animate-pulse rounded bg-white/10" /></div>
        ) : (
          <div className="fade-up">
            <p className="display-font mt-4 text-[17px] font-semibold leading-6 text-[#fffdf5]">{summary.headline}</p>
            {summary.bullets.length > 0 && <ul className="mt-3 space-y-2">{summary.bullets.map((bullet) => <li key={bullet} className="flex gap-2 text-[12.5px] leading-5 text-[#dfe2dc]"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#a1d2b6]" />{bullet}</li>)}</ul>}
          </div>
        )}
        <div className="mt-5 flex items-end justify-between border-t border-white/15 pt-4">
          <div><span className="display-font text-3xl font-bold">{summary.count}</span><span className="ml-2 text-xs text-[#c4cbbb]">events ahead</span></div>
          <div className="text-right"><span className="display-font text-2xl font-bold text-[#f0ae86]">{summary.required}</span><p className="text-[10px] uppercase tracking-wider text-[#c4cbbb]">required</p></div>
        </div>
      </div>
    </section>
  );
}
