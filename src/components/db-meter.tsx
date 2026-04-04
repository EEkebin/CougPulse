"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  stream: MediaStream | null;
  onDbChange?: (db: number) => void;
}

export function DbMeter({ stream, onDbChange }: Props) {
  const [db, setDb] = useState<number>(-Infinity);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!stream) return;

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    ctxRef.current = audioCtx;
    analyserRef.current = analyser;

    const buf = new Float32Array(analyser.fftSize);

    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      const level = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
      setDb(level);
      onDbChange?.(level);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtx.close();
    };
  }, [stream]);

  const clamped = Math.max(-60, Math.min(0, db));
  const pct = ((clamped + 60) / 60) * 100;
  const color =
    clamped > -10 ? "#ef4444" : clamped > -25 ? "#f59e0b" : "#22c55e";
  const label =
    db === -Infinity ? "-∞" : `${db.toFixed(1)} dB`;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-neutral-900/80 backdrop-blur rounded-full border border-neutral-800">
      <span className="text-neutral-400 text-xs font-mono uppercase tracking-widest">dB</span>
      <div className="w-32 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-white text-xs font-mono w-16 text-right">{label}</span>
    </div>
  );
}
