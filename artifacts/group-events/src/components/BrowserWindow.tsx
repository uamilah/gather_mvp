import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, FileText, Lock, MoreVertical, Plus, Puzzle, RotateCw, Star, X } from "lucide-react";

type Props = {
  badge: number;
  popupOpen: boolean;
  onExtensionClick: () => void;
  popup: ReactNode;
  children: ReactNode;
};

const TABS = [
  { title: "My Calendar", icon: CalendarDays, active: true },
  { title: "Fall Career Fair · Employers", icon: FileText, active: false },
  { title: "CHEM 140A Lecture 12 notes", icon: FileText, active: false },
];

export function BrowserWindow({ badge, popupOpen, onExtensionClick, popup, children }: Props) {
  return (
    <div className="flex h-[872px] w-[1100px] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_40px_80px_-20px_rgba(37,44,65,.40),0_0_0_1px_rgba(0,0,0,.08)]">
      {/* Tab strip */}
      <div className="flex h-[42px] shrink-0 items-end gap-1 bg-[#dfe3e8] pl-4 pr-3">
        <div className="mb-[13px] mr-3 flex gap-2"><span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" /></div>
        {TABS.map((tab) => (
          <div key={tab.title} className={`relative flex h-[34px] w-[220px] items-center gap-2 rounded-t-[10px] px-3 text-[12.5px] ${tab.active ? "bg-white text-[#1f1f1f]" : "text-[#4a4f55]"}`}>
            <tab.icon size={14} className={tab.active ? "text-[#43876e]" : "text-[#6b7075]"} />
            <span className="truncate">{tab.title}</span>
            <X size={13} className="ml-auto shrink-0 text-[#6b7075]" />
            {!tab.active && <span className="absolute -right-0.5 top-2 h-[18px] w-px bg-[#b9bec4]" />}
          </div>
        ))}
        <Plus size={16} className="mb-[10px] ml-1 text-[#4a4f55]" />
      </div>

      {/* Toolbar */}
      <div className="relative z-30 flex h-[46px] shrink-0 items-center gap-1 border-b border-[#e4e6e9] bg-white px-2.5">
        {[ArrowLeft, ArrowRight, RotateCw].map((Icon, i) => <span key={i} className={`flex h-8 w-8 items-center justify-center rounded-full ${i === 1 ? "text-[#b5b9be]" : "text-[#4a4f55]"}`}><Icon size={17} /></span>)}
        <div className="mx-2 flex h-[34px] flex-1 items-center gap-2.5 rounded-full bg-[#eef1f4] px-4 text-[14px]">
          <Lock size={13} className="text-[#5f6368]" />
          <span className="text-[#1f1f1f]">calendar.app</span><span className="-ml-2 text-[#6b7075]">/month</span>
          <Star size={15} className="ml-auto text-[#5f6368]" />
        </div>
        <button onClick={onExtensionClick} className={`relative flex h-8 w-8 items-center justify-center rounded-full transition ${popupOpen ? "bg-[#e3e8ee]" : "hover:bg-[#eef1f4]"}`} aria-label="Gather extension" data-testid="button-extension">
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-[#252c41] text-[#a1d2b6]"><CalendarDays size={13} strokeWidth={2.5} /></span>
          {badge > 0 && <span className="pop-in absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-[#e8553e] px-1 text-[9.5px] font-bold text-white">{badge}</span>}
        </button>
        <span className="flex h-8 w-8 items-center justify-center text-[#4a4f55]"><Puzzle size={17} /></span>
        <span className="mx-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#f0bd91] text-[12px] font-bold text-[#333548]">Y</span>
        <span className="flex h-8 w-6 items-center justify-center text-[#4a4f55]"><MoreVertical size={17} /></span>
        {popup}
      </div>

      {/* Page. The transform makes fixed-position modals stay inside the browser. */}
      <div className="relative min-h-0 flex-1 overflow-hidden" style={{ transform: "translateZ(0)" }}>{children}</div>
    </div>
  );
}
