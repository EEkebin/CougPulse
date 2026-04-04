"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CampusMap, RoomWithReading } from "@/components/campus-map";
import { Badge } from "@/components/ui/badge";

export default function MapPage() {
  const [rooms, setRooms] = useState<RoomWithReading[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const selectedRoom = rooms.find((r) => r.number === selected) ?? null;

  const fetchRooms = useCallback(async () => {
    const res = await fetch("/api/rooms");
    if (res.ok) setRooms(await res.json());
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const db = selectedRoom?.reading?.dbLevel ?? null;
  const status =
    db === null ? "No data"
    : db < -40 ? "QUIET"
    : db < -25 ? "MODERATE"
    : "LOUD";
  const statusColor =
    db === null ? "bg-neutral-800 text-neutral-400"
    : db < -40 ? "bg-green-900 text-green-400"
    : db < -25 ? "bg-yellow-900 text-yellow-400"
    : "bg-red-900 text-red-400";

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">CougPulse</span>
          <span className="text-neutral-500 text-sm">/ Campus Map</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-800 border border-green-500 inline-block" />
              Quiet
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-yellow-800 border border-yellow-500 inline-block" />
              Moderate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-900 border border-red-500 inline-block" />
              Loud
            </span>
          </div>
          <Link
            href="/"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors font-mono"
          >
            ← Camera
          </Link>
        </div>
      </header>

      {/* Map */}
      <div
        className="flex-1 p-4 flex items-center justify-center"
        onClick={() => setSelected(null)}
      >
        <div
          className="w-full max-w-6xl"
          onClick={(e) => e.stopPropagation()}
        >
          <CampusMap
            rooms={rooms}
            selectedRoom={selected}
            onSelect={setSelected}
          />
        </div>
      </div>

      {/* Room detail panel */}
      {selectedRoom && (
        <div className="border-t border-neutral-800 bg-neutral-900 px-6 py-5">
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{selectedRoom.name}</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-neutral-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Noise</span>
                <Badge className={statusColor}>{status}</Badge>
                {db !== null && (
                  <span className="text-neutral-500 font-mono text-xs">
                    {db.toFixed(1)} dB
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Occupants</span>
                {selectedRoom.reading?.occupants.length ? (
                  <span className="text-white">
                    {selectedRoom.reading.occupants.join(", ")}
                  </span>
                ) : (
                  <span className="text-neutral-600">None detected</span>
                )}
              </div>

              {selectedRoom.reading && (
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400">Updated</span>
                  <span className="text-neutral-500 text-xs">
                    {new Date(selectedRoom.reading.updatedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
