"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FloorPlanCanvas from "@/components/FloorPlanCanvas";
import { clampNoise, noiseColorFromValue } from "@/lib/noise";
import type { LayoutFloor, LayoutPoint } from "@/lib/layout-types";

type RoomReading = {
  id: string;
  floor: number;
  name: string;
  audioLevel: number | null;
  activeDeviceCount: number;
  updatedAt: string | null;
};

const HEATMAP_POLL_MS = 2000;
const SVG_SIZE = 1000;

function pointsToSvg(points: LayoutPoint[]) {
  return points.map((point) => `${Math.round(point.x * SVG_SIZE)},${Math.round(point.y * SVG_SIZE)}`).join(" ");
}

function centroid(points: LayoutPoint[]) {
  const total = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

function timestampText() {
  return `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function MapPage() {
  const [floors, setFloors] = useState<LayoutFloor[]>([]);
  const [currentFloorId, setCurrentFloorId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [readings, setReadings] = useState<Map<string, RoomReading>>(new Map());
  const [mapTimestamp, setMapTimestamp] = useState("Waiting for live room updates");

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const [floorsRes, roomsRes] = await Promise.all([
          fetch("/api/floors", { cache: "no-store" }),
          fetch("/api/rooms", { cache: "no-store" }),
        ]);

        if (!active) return;

        if (floorsRes.ok) {
          const floorData: LayoutFloor[] = await floorsRes.json();
          setFloors(floorData);
          setCurrentFloorId((current) => current ?? floorData[0]?.id ?? null);
        }

        if (roomsRes.ok) {
          const roomData: RoomReading[] = await roomsRes.json();
          setReadings(new Map(roomData.map((reading) => [reading.id, reading])));
          setMapTimestamp(timestampText());
        }
      } catch {
        if (active) setMapTimestamp("Waiting for live room updates");
      }
    }

    refresh();
    const interval = window.setInterval(refresh, HEATMAP_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const currentFloor = floors.find((floor) => floor.id === currentFloorId) ?? floors[0] ?? null;

  const selectedRoom = currentFloor?.rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedReading = selectedRoom ? readings.get(selectedRoom.id) : null;

  const liveRooms = !currentFloor
    ? []
    : currentFloor.rooms
        .map((room) => ({ room, reading: readings.get(room.id) }))
        .filter((item) => item.reading?.audioLevel != null && (item.reading?.activeDeviceCount ?? 0) > 0)
        .sort((a, b) => (a.reading?.audioLevel ?? 0) - (b.reading?.audioLevel ?? 0));

  return (
    <main className="ross-shell">
      <header className="ross-top-bar">
        <div>
          <h1>CougPulse Student Heatmap</h1>
          <p>Live room noise across the current campus layout.</p>
        </div>
        <div className="ross-top-actions">
          <Link href="/login?next=/admin" className="ross-link-btn">
            Admin Panel
          </Link>
          <Link href="/device" className="ross-btn ross-btn-primary">
            Device Login
          </Link>
          <div className="ross-status-pill">
            {currentFloor?.name ?? "No Floor"} · {liveRooms.length} Live Rooms
          </div>
        </div>
      </header>

      <main className="ross-app-shell">
        <aside className="ross-panel">
          <section className="ross-card">
            <h2>Floors</h2>
            <div className="ross-mode-row">
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  className={`ross-mode-btn${currentFloor?.id === floor.id ? " active" : ""}`}
                  onClick={() => setCurrentFloorId(floor.id)}
                >
                  {floor.name}
                </button>
              ))}
            </div>
          </section>

          <section className="ross-card">
            <h2>Noise Legend</h2>
            <div className="ross-legend-list">
              <div className="ross-gradient-legend" aria-hidden="true" />
              <div className="ross-gradient-legend-labels">
                <span>0% / Green</span>
                <span>100% / Red</span>
              </div>
              <div className="ross-legend-caption">Lower noise stays green. Higher noise shifts toward red.</div>
              <div className="ross-legend-item">
                <span className="ross-legend-chip ross-room-unassigned-chip" />
                <span>No device assigned</span>
              </div>
            </div>
          </section>

          <section className="ross-card">
            <h2>Selected Room</h2>
            {selectedRoom ? (
              <div className="ross-inspector">
                <div className="ross-field-group">
                  <label>Room Name</label>
                  <div className="ross-field-value">{selectedRoom.name}</div>
                </div>
                <div className="ross-field-group">
                  <label>Current Noise</label>
                  <div className="ross-field-value">
                    {selectedReading?.audioLevel != null && (selectedReading.activeDeviceCount ?? 0) > 0
                      ? `${clampNoise(selectedReading.audioLevel)}%`
                      : "No device assigned"}
                  </div>
                </div>
                <div className="ross-field-group">
                  <label>Active Devices</label>
                  <div className="ross-field-value">{selectedReading?.activeDeviceCount ?? 0}</div>
                </div>
                <div className="ross-field-group">
                  <label>Last Update</label>
                  <div className="ross-field-value">
                    {selectedReading?.updatedAt ? new Date(selectedReading.updatedAt).toLocaleTimeString() : "No live update"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="ross-inspector ross-empty">Select a room on the map.</div>
            )}
          </section>
        </aside>

        <section className="ross-canvas-panel">
          <div className="ross-canvas-tools">
            <div className="ross-tool-pill">{mapTimestamp}</div>
          </div>
          <FloorPlanCanvas
            floorPlanImage={currentFloor?.floorPlanImage}
            floorName={currentFloor?.name}
            placeholderText="No floor plan uploaded for this floor yet."
            svgSize={SVG_SIZE}
            svgProps={{
              onClick: () => setSelectedRoomId(null),
            }}
          >
              {currentFloor?.rooms.map((room) => {
                const reading = readings.get(room.id);
                const value = reading?.audioLevel != null && (reading.activeDeviceCount ?? 0) > 0 ? clampNoise(reading.audioLevel) : null;
                const center = centroid(room.points);
                const tiny = room.points.length <= 4 && room.points.some((point) => point.x > 0.95);

                return (
                  <g
                    key={room.id}
                    className="ross-room-group"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedRoomId(room.id);
                    }}
                  >
                    <polygon
                      points={pointsToSvg(room.points)}
                      className={`ross-room-shape ${value == null ? "ross-room-unassigned" : ""}${selectedRoomId === room.id ? " selected" : ""}`}
                      style={value != null ? { fill: noiseColorFromValue(value) } : undefined}
                    />
                    <text className={`ross-room-label${tiny ? " ross-room-label-tiny" : ""}`} x={center.x * SVG_SIZE} y={(center.y - 0.012) * SVG_SIZE}>
                      {room.name}
                    </text>
                    <text className={`ross-room-meta-label${tiny ? " ross-room-label-tiny" : ""}`} x={center.x * SVG_SIZE} y={(center.y + 0.012) * SVG_SIZE}>
                      {value != null ? `${value}%` : "No device"}
                    </text>
                  </g>
                );
              })}
          </FloorPlanCanvas>
        </section>

        <aside className="ross-panel">
          <section className="ross-card">
            <h2>Quietest Rooms</h2>
            <div className={`ross-list${liveRooms.length ? "" : " ross-empty"}`}>
              {liveRooms.length ? (
                liveRooms.map(({ room, reading }) => (
                  <button key={room.id} type="button" className="ross-item ross-item-button" onClick={() => setSelectedRoomId(room.id)}>
                    <div className="ross-item-head">
                      <strong>{room.name}</strong>
                      <span>{clampNoise(reading!.audioLevel!)}%</span>
                    </div>
                    <div className="ross-item-subtle">{reading?.activeDeviceCount} active device{reading?.activeDeviceCount === 1 ? "" : "s"}</div>
                  </button>
                ))
              ) : (
                "No rooms with assigned live devices yet."
              )}
            </div>
          </section>
        </aside>
      </main>
    </main>
  );
}
