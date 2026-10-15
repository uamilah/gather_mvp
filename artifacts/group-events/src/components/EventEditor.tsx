import { useEffect, useState, type FormEvent } from "react";
import { TYPE_STYLE } from "@/demo/colors";
import { CLUBS } from "@/demo/seed";
import { EVENT_TYPES, type Event, type EventInput, type EventType } from "@/demo/types";
import { CalendarDays, MapPin, X } from "lucide-react";

type Props = {
  event?: Event | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (input: EventInput) => void;
};


export function EventEditor({ event, busy = false, onClose, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<EventType>("meeting");
  const [mandatory, setMandatory] = useState(false);
  const [clubId, setClubId] = useState(CLUBS[0].id);

  useEffect(() => {
    setTitle(event?.title ?? "");
    setDate(event?.date ?? "");
    setStartTime(event?.startTime ?? "");
    setLocation(event?.location ?? "");
    setDescription(event?.description ?? "");
    setType(event?.type ?? "meeting");
    setMandatory(event?.mandatory ?? false);
    setClubId(event?.clubId ?? CLUBS[0].id);
  }, [event]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSave({
      clubId,
      title: title.trim(),
      date,
      startTime: startTime || null,
      location: location.trim() || "Location TBD",
      description: description.trim() || null,
      type,
      mandatory,
    });
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="fade-up w-full max-h-[92dvh] max-w-[560px] overflow-y-auto rounded-2xl border border-[#ded9cc] bg-[#fbfaf6] shadow-[0_24px_80px_rgba(28,35,52,.24)]" role="dialog" aria-modal="true" aria-labelledby="event-editor-title">
        <div className="flex items-start justify-between border-b border-[#e7e2d7] px-6 py-5">
          <div>
            <p className="mono-font text-[10px] font-semibold uppercase tracking-[.18em] text-[#43876e]">{event ? "E-board / edit event" : "E-board / new event"}</p>
            <h2 id="event-editor-title" className="display-font mt-1 text-2xl font-bold">{event ? "Shape the details" : "Put it on the calendar"}</h2>
          </div>
          <button className="rounded-lg p-2 text-[#737987] transition hover:bg-[#efede6] hover:text-[#252c41]" onClick={onClose} aria-label="Close editor" data-testid="button-close-editor"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <label className="block text-sm font-semibold">Club
            <select value={clubId} onChange={(e) => setClubId(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#d9d5ca] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#43876e]" data-testid="select-event-club">
              {CLUBS.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Event name
            <input required maxLength={180} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Welcome week planning" className="mt-1.5 w-full rounded-lg border border-[#d9d5ca] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#43876e] focus:ring-2 focus:ring-[#43876e]/15" data-testid="input-event-title" />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Date
              <span className="relative mt-1.5 block"><CalendarDays size={16} className="pointer-events-none absolute left-3 top-3 text-[#899087]" /><input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-[#d9d5ca] bg-white py-2.5 pl-9 pr-2 text-sm outline-none focus:border-[#43876e]" data-testid="input-event-date" /></span>
            </label>
            <label className="block text-sm font-semibold">Start time
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#d9d5ca] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#43876e]" data-testid="input-event-time" />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Kind
              <select value={type} onChange={(e) => setType(e.target.value as EventType)} className="mt-1.5 w-full rounded-lg border border-[#d9d5ca] bg-white px-3 py-2.5 text-sm capitalize outline-none focus:border-[#43876e]" data-testid="select-event-type">
                {EVENT_TYPES.map((kind) => <option key={kind} value={kind}>{TYPE_STYLE[kind].label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">Where
              <span className="relative mt-1.5 block"><MapPin size={16} className="pointer-events-none absolute left-3 top-3 text-[#899087]" /><input maxLength={240} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room, venue or link" className="w-full rounded-lg border border-[#d9d5ca] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#43876e]" data-testid="input-event-location" /></span>
            </label>
          </div>
          <label className="block text-sm font-semibold">A little context
            <textarea maxLength={2000} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should members know?" className="mt-1.5 w-full resize-y rounded-lg border border-[#d9d5ca] bg-white px-3.5 py-3 text-sm outline-none focus:border-[#43876e]" data-testid="input-event-description" />
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e4dfd3] bg-[#f5f3ec] p-3.5">
            <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} className="h-4 w-4 accent-[#43876e]" data-testid="input-event-mandatory" />
            <span><span className="block text-sm font-semibold">Required for members</span><span className="mt-0.5 block text-xs text-[#737987]">Flag this event as a club commitment.</span></span>
          </label>
          <div className="flex justify-end gap-2 border-t border-[#e7e2d7] pt-4">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#5e6572] transition hover:bg-[#efede6]" data-testid="button-cancel-event">Cancel</button>
            <button disabled={busy} type="submit" className="rounded-lg bg-[#43876e] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#34745b] disabled:cursor-wait disabled:opacity-60" data-testid="button-save-event">{busy ? "Saving…" : event ? "Save changes" : "Create event"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
