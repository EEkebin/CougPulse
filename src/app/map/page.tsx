"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ROOMS, MAP_W, MAP_H } from "@/lib/rooms";

type RoomReading = { id: string; audioLevel: number; updatedAt: string };

const STALE_MS = 10_000; // reading older than 10s is considered stale

function levelToColor(level: number): { bg: string; border: string } {
  // Normalize: 0 = silent, 60+ = very loud
  const t = Math.min(1, level / 60);

  let r: number, g: number, b: number;
  if (t < 0.5) {
    const u = t * 2;
    r = Math.round(16  + u * (234 - 16));
    g = Math.round(185 + u * (179 - 185));
    b = Math.round(129 + u * (8   - 129));
  } else {
    const u = (t - 0.5) * 2;
    r = Math.round(234 + u * (239 - 234));
    g = Math.round(179 + u * (68  - 179));
    b = Math.round(8   + u * (68  - 8));
  }

  const alpha = 0.12 + t * 0.45;
  const borderAlpha = 0.3 + t * 0.5;
  return {
    bg: `rgba(${r},${g},${b},${alpha.toFixed(2)})`,
    border: `rgba(${r},${g},${b},${borderAlpha.toFixed(2)})`,
  };
}

export default function MapPage() {
  const [readings, setReadings] = useState<Map<string, RoomReading>>(new Map());
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchReadings() {
    try {
      const res = await fetch("/api/rooms");
      if (!res.ok) return;
      const data: RoomReading[] = await res.json();
      setReadings(new Map(data.map(r => [r.id, r])));
      setLastFetch(new Date());
    } catch {}
  }

  useEffect(() => {
    fetchReadings();
    intervalRef.current = setInterval(fetchReadings, 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tighter italic">
              COUG<span className="text-emerald-500">PULSE</span>
              <span className="text-zinc-600 text-xl ml-3 not-italic font-bold">/ ACOUSTIC MAP</span>
            </h1>
            <p className="text-zinc-600 text-[9px] font-black uppercase tracking-[0.5em] mt-1">
              Live room noise heatmap — updates every 3s
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastFetch && (
              <span className="text-[9px] font-mono text-zinc-600">
                Last sync: {lastFetch.toLocaleTimeString()}
              </span>
            )}
            <Link href="/"
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-colors">
              ← Back
            </Link>
          </div>
        </div>

        {/* Map */}
        <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900">
          {/* Aspect-ratio wrapper matching the floor plan */}
          <div style={{ position: "relative", paddingTop: `${(MAP_H / MAP_W) * 100}%` }}>
            {/* Floor plan image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/map.png"
              alt="Floor plan"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill" }}
            />

            {/* Room overlays */}
            {ROOMS.map(room => {
              const reading = readings.get(room.id);
              const isStale = reading
                ? Date.now() - new Date(reading.updatedAt).getTime() > STALE_MS
                : true;
              const level = reading && !isStale ? reading.audioLevel : 0;
              const hasData = reading && !isStale;

              const { bg, border } = hasData
                ? levelToColor(level)
                : { bg: "rgba(255,255,255,0)", border: "rgba(255,255,255,0)" };

              const left   = `${(room.x / MAP_W) * 100}%`;
              const top    = `${(room.y / MAP_H) * 100}%`;
              const width  = `${(room.w / MAP_W) * 100}%`;
              const height = `${(room.h / MAP_H) * 100}%`;
              const pct    = Math.round(Math.min(100, (level / 60) * 100));

              return (
                <div
                  key={room.id}
                  title={`${room.name}${hasData ? ` — ${pct}%` : " — no device"}`}
                  style={{
                    position: "absolute",
                    left, top, width, height,
                    backgroundColor: bg,
                    border: `1px solid ${border}`,
                    boxSizing: "border-box",
                    transition: "background-color 0.6s ease, border-color 0.6s ease",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "flex-start",
                    padding: "2px 4px",
                  }}
                >
                  {hasData && (
                    <span style={{
                      fontSize: "clamp(6px, 1.1vw, 11px)",
                      fontFamily: "monospace",
                      fontWeight: 900,
                      color: "rgba(255,255,255,0.85)",
                      lineHeight: 1,
                      textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                      pointerEvents: "none",
                    }}>
                      {pct}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend + room list */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Color scale */}
          <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800 space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Noise Level Scale</h3>
            <div className="h-4 w-full rounded-full overflow-hidden" style={{
              background: "linear-gradient(to right, rgba(16,185,129,0.6), rgba(234,179,8,0.6), rgba(239,68,68,0.7))"
            }} />
            <div className="flex justify-between text-[9px] font-mono text-zinc-500">
              <span>Silent</span>
              <span>Moderate</span>
              <span>Loud</span>
            </div>
          </div>

          {/* Live room list */}
          <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800 space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Active Devices ({readings.size})
            </h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
              {ROOMS.filter(r => readings.has(r.id)).map(room => {
                const reading = readings.get(room.id)!;
                const stale = Date.now() - new Date(reading.updatedAt).getTime() > STALE_MS;
                const pct   = Math.round(Math.min(100, (reading.audioLevel / 60) * 100));
                const { bg } = levelToColor(reading.audioLevel);
                return (
                  <div key={room.id} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: stale ? "#3f3f46" : bg.replace(/[\d.]+\)$/, "0.9)") }} />
                    <span className="text-[10px] font-mono text-zinc-400 flex-1 uppercase truncate">{room.name}</span>
                    <span className={`text-[10px] font-mono font-bold ${stale ? "text-zinc-700" : "text-zinc-300"}`}>
                      {stale ? "stale" : `${pct}%`}
                    </span>
                  </div>
                );
              })}
              {readings.size === 0 && (
                <p className="text-[10px] text-zinc-700 italic text-center py-4">
                  No devices reporting — select a room on the main page
                </p>
              )}
            </div>
          </div>
        </div>

        <footer className="text-[8px] font-black text-zinc-800 uppercase tracking-[0.5em] border-t border-zinc-900 pt-6">
          © 2026 COUGPULSE DEFENSE SYSTEMS // ACOUSTIC INTELLIGENCE V1.0
        </footer>
      </div>
    </div>
  );
}
