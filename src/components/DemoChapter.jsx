import { useState, useEffect, useRef } from "react";
import "./InteractivePlayer.css";

export default function DemoChapter({ id, chapter, config, isPaused, onTimeUpdate, onEnded }) {
  const [elapsed, setElapsed] = useState(0);
  const onEndedRef = useRef(onEnded);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  useEffect(() => { onEndedRef.current = onEnded; });
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; });

  useEffect(() => {
    if (isPaused) return;

    const duration = chapter.demoDuration;
    const startTime = performance.now();
    let rafId;

    const tick = (now) => {
      const t = Math.min((now - startTime) / 1000, duration);
      setElapsed(t);
      onTimeUpdateRef.current(t);
      if (t >= duration) {
        onEndedRef.current();
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPaused, chapter.demoDuration]);

  const progress = Math.min(elapsed / chapter.demoDuration, 1);

  return (
    <div className="demo-chapter">
      <div className="demo-chapter__content">
        <div className="demo-chapter__id">{id}</div>
        <div className="demo-chapter__label">{chapter.demoLabel ?? chapter.label}</div>
        {isPaused && (
          <div className="demo-chapter__paused">⏸ 選択待ち</div>
        )}
      </div>
      <span className="demo-chapter__badge">DEMO</span>
      <div className="demo-chapter__progress">
        <div
          className="demo-chapter__progress-fill"
          style={{ width: `${progress * 100}%`, background: config.theme.primary }}
        />
      </div>
    </div>
  );
}
