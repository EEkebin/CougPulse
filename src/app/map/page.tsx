"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FLOORS, ROOM_MAP } from "@/lib/rooms";
import { NOISE_LEVELS, clampNoise, levelFromValue } from "@/lib/noise";

type RoomReading = {
  id: string;
  floor: number;
  name: string;
  audioLevel: number | null;
  activeDeviceCount: number;
  updatedAt: string | null;
};

const HEATMAP_POLL_MS = 2000;

function timestampText() {
  return `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function MapPage() {
  const [currentFloor, setCurrentFloor] = useState(1);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [readings, setReadings] = useState<Map<string, RoomReading>>(new Map());
  const [mapTimestamp, setMapTimestamp] = useState("Updated just now");

  useEffect(() => {
    let active = true;

    async function fetchReadings() {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        if (!res.ok) return;
        const data: RoomReading[] = await res.json();
        if (!active) return;
        setReadings(new Map(data.map((reading) => [reading.id, reading])));
        setMapTimestamp(timestampText());
      } catch {
        if (active) setMapTimestamp("Waiting for live room updates");
      }
    }

    fetchReadings();
    const interval = window.setInterval(fetchReadings, HEATMAP_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const floorData = FLOORS[currentFloor];

  useEffect(() => {
    if (!selectedRoomId) return;
    const room = ROOM_MAP.get(selectedRoomId);
    if (!room || room.floor !== currentFloor) {
      setSelectedRoomId(null);
    }
  }, [currentFloor, selectedRoomId]);

  const selectedRoom = selectedRoomId ? ROOM_MAP.get(selectedRoomId) ?? null : null;
  const selectedReading = selectedRoom ? readings.get(selectedRoom.id) : undefined;

  const quietestRooms = useMemo(() => {
    return floorData.rooms
      .map((room) => ({
        room,
        reading: readings.get(room.id),
        score: readings.get(room.id)?.audioLevel,
      }))
      .filter((item) => item.score != null && (item.reading?.activeDeviceCount ?? 0) > 0)
      .map((item) => ({ ...item, score: clampNoise(item.score!) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }, [floorData.rooms, readings]);

  return (
    <main className="cp-shell">
      <div className="cp-bg-shape cp-shape-a" aria-hidden="true" />
      <div className="cp-bg-shape cp-shape-b" aria-hidden="true" />

      <div className="cp-app-shell">
        <section className="cp-dashboard" aria-label="Noise map dashboard">
          <header className="cp-card cp-topbar">
            <div>
              <h1>CougPulse - WSU Everett Campus Map</h1>
              <p>Live View: Click any room to inspect current noise and device coverage</p>
            </div>
            <div className="cp-topbar-actions">
              <Link href="/" className="cp-btn cp-btn-ghost">
                Security Dashboard
              </Link>
              <Link href="/device" className="cp-btn cp-btn-primary">
                Join as Device
              </Link>
            </div>
          </header>

          <section className="cp-card cp-controls">
            <div className="cp-floor-selector" role="tablist" aria-label="Floor selector">
              {Object.keys(FLOORS).map((floor) => {
                const floorNumber = Number(floor);
                const active = floorNumber === currentFloor;
                return (
                  <button
                    key={floor}
                    className={`cp-btn cp-floor-btn${active ? " active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCurrentFloor(floorNumber)}
                  >
                    Floor {floor}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="cp-card cp-legend" aria-label="Noise legend">
            <h4>Noise Scale</h4>
            <div className="cp-legend-items">
              {NOISE_LEVELS.map((level) => (
                <span key={level.name}>
                  <i className={`cp-chip ${level.className}`} />
                  {level.name}
                </span>
              ))}
            </div>
          </section>

          {selectedRoom && (
            <section className="cp-card cp-predictive-panel" aria-label="Room predictive insights">
              <div className="cp-predictive-panel-head">
                <div>
                  <h3>{selectedRoom.name} Live Status</h3>
                  <p>Current room monitoring state</p>
                </div>
                <button
                  className="cp-close-panel"
                  type="button"
                  aria-label="Close predictive panel"
                  onClick={() => setSelectedRoomId(null)}
                >
                  X
                </button>
              </div>

              <div className="cp-chart-shell">
                <div className="cp-empty-state" aria-live="polite">
                  {selectedReading?.activeDeviceCount
                    ? "This room is reporting live noise data right now."
                    : "No device assigned to this room."}
                </div>
              </div>

              <div className="cp-room-insight-grid">
                <div>
                  <span className="cp-insight-label">Current Level</span>
                  <strong>{selectedReading?.audioLevel != null && (selectedReading.activeDeviceCount ?? 0) > 0 ? `${clampNoise(selectedReading.audioLevel)}%` : "No device assigned"}</strong>
                </div>
                <div>
                  <span className="cp-insight-label">Active Devices</span>
                  <strong>{selectedReading?.activeDeviceCount ?? 0}</strong>
                </div>
                <div>
                  <span className="cp-insight-label">Last Update</span>
                  <strong>{selectedReading?.updatedAt ? new Date(selectedReading.updatedAt).toLocaleTimeString() : "No live device yet"}</strong>
                </div>
              </div>
            </section>
          )}

          <section className="cp-card cp-map-card">
            <div className="cp-map-title-row">
              <h3>Floor {currentFloor} Map</h3>
              <div>{mapTimestamp}</div>
            </div>

            <div className="cp-floor-map" aria-live="polite">
              <div className="cp-floor-outline" />

              {floorData.corridors.map((segment, index) => (
                <div
                  key={`corridor-${index}`}
                  className="cp-corridor"
                  style={{ left: `${segment.x}%`, top: `${segment.y}%`, width: `${segment.w}%`, height: `${segment.h}%` }}
                />
              ))}

              <div
                className="cp-stairs"
                style={{
                  left: `${floorData.stairs.x}%`,
                  top: `${floorData.stairs.y}%`,
                  width: `${floorData.stairs.w}%`,
                  height: `${floorData.stairs.h}%`,
                }}
              >
                Stairs
              </div>

              {floorData.rooms.map((room) => {
                const reading = readings.get(room.id);
                const hasDevice = (reading?.activeDeviceCount ?? 0) > 0 && reading?.audioLevel != null;
                const value = hasDevice && reading?.audioLevel != null ? clampNoise(reading.audioLevel) : null;
                const level = value != null ? levelFromValue(value) : null;

                return (
                  <article
                    key={room.id}
                    className={`cp-room ${level ? level.className : "cp-room-unassigned"}${room.shape ? ` cp-room-${room.shape}` : ""}${selectedRoomId === room.id ? " is-selected" : ""}`}
                    style={{ left: `${room.x}%`, top: `${room.y}%`, width: `${room.w}%`, height: `${room.h}%` }}
                    title={`Open live status for ${room.name}`}
                    onClick={() => setSelectedRoomId(room.id)}
                  >
                    <div className="cp-label">{room.name}</div>
                    <div className="cp-meta">{value != null ? `${value}% audio` : "No device assigned"}</div>
                    <div className="cp-meta">
                      {level ? level.name : "Offline"}
                      {reading?.activeDeviceCount ? ` · ${reading.activeDeviceCount} device${reading.activeDeviceCount === 1 ? "" : "s"}` : ""}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="cp-card cp-stats-card" aria-label="Quietest rooms">
            <div className="cp-stats-header">
              <div>
                <h3>Quietest Rooms on Floor {currentFloor}</h3>
                <p>Only rooms with at least one assigned live device appear here.</p>
              </div>
            </div>
            <div className="cp-quiet-list">
              {quietestRooms.length === 0 && (
                <div className="cp-empty-state">No device assigned on this floor yet.</div>
              )}
              {quietestRooms.map(({ room, reading, score }) => (
                <button key={room.id} type="button" className="cp-quiet-item" onClick={() => setSelectedRoomId(room.id)}>
                  <span>{room.name}</span>
                  <strong>{score}%</strong>
                  <small>{reading?.activeDeviceCount ? `${reading.activeDeviceCount} live device` : "No device assigned"}</small>
                </button>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
