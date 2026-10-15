import { useEffect, useState, type ReactNode } from "react";

// Renders a fixed-size scene scaled to fit its container, like a product shot.
export function Stage({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!box) return;
    const fit = () => setScale(Math.min(box.clientWidth / width, box.clientHeight / height));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [box, width, height]);

  return (
    <div ref={setBox} className="relative min-h-0 flex-1 overflow-hidden">
      <div className="absolute left-1/2 top-1/2" style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
