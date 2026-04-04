"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminFetch } from "@/lib/admin-client";
import LoadingSpinner from "@/components/LoadingSpinner";
import FloorPlanCanvas from "@/components/FloorPlanCanvas";
import type { LayoutFloor, LayoutPoint } from "@/lib/layout-types";

const SVG_SIZE = 1000;

type Mode = "select" | "draw-rect" | "draw-polygon";

type DragState = {
  roomId: string;
  startPoint: LayoutPoint;
  originalPoints: LayoutPoint[];
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function pointsToSvg(points: LayoutPoint[]) {
  return points.map((point) => `${Math.round(point.x * SVG_SIZE)},${Math.round(point.y * SVG_SIZE)}`).join(" ");
}

function centroid(points: LayoutPoint[]) {
  const total = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

function rectPoints(start: LayoutPoint, end: LayoutPoint) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);

  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function normalizePoints(points: LayoutPoint[]) {
  return points.map((point) => ({
    x: clamp(point.x),
    y: clamp(point.y),
  }));
}

export default function FloorLayoutEditor({
  floors,
  onLayoutChange,
}: {
  floors: LayoutFloor[];
  onLayoutChange: () => Promise<void>;
}) {
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(floors[0]?.id ?? null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("select");
  const [draftRectStart, setDraftRectStart] = useState<LayoutPoint | null>(null);
  const [draftRectCurrent, setDraftRectCurrent] = useState<LayoutPoint | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<LayoutPoint[]>([]);
  const [polygonHover, setPolygonHover] = useState<LayoutPoint | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<{ roomId: string; points: LayoutPoint[] } | null>(null);
  const [roomNameDraft, setRoomNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const selectedFloor = useMemo(() => floors.find((floor) => floor.id === selectedFloorId) ?? floors[0] ?? null, [floors, selectedFloorId]);

  const selectedRoom = selectedFloor?.rooms.find((room) => room.id === selectedRoomId) ?? null;

  function getRelativePoint(event: React.PointerEvent<SVGElement>) {
    const rect = canvasWrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0.5, y: 0.5 };

    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  }

  const createRoom = useCallback(async (points: LayoutPoint[]) => {
    if (!selectedFloor) return;
    if (points.length < 3) return;

    const res = await adminFetch("/api/layout/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        floorId: selectedFloor.id,
        name: `Room ${selectedFloor.rooms.length + 1}`,
        shape: "polygon",
        points: normalizePoints(points),
      }),
    });

    if (!res.ok) return;
    const room = await res.json();
    setSelectedRoomId(room.id);
    setRoomNameDraft(room.name);
    await onLayoutChange();
  }, [onLayoutChange, selectedFloor]);

  async function moveRoom(roomId: string, points: LayoutPoint[]) {
    await adminFetch(`/api/layout/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: normalizePoints(points) }),
    });
    await onLayoutChange();
  }

  function offsetPoints(points: LayoutPoint[], dx: number, dy: number) {
    return points.map((point) => ({ x: clamp(point.x + dx), y: clamp(point.y + dy) }));
  }

  const cancelDrawingMode = useCallback(() => {
    setDraftRectStart(null);
    setDraftRectCurrent(null);
    setPolygonPoints([]);
    setPolygonHover(null);
    setDragState(null);
    setDragPreview(null);
    setMode("select");
  }, []);

  const finishPolygonShape = useCallback(() => {
    if (mode !== "draw-polygon") return;
    if (polygonPoints.length >= 3) void createRoom(polygonPoints);
    setPolygonPoints([]);
    setPolygonHover(null);
    setMode("select");
  }, [createRoom, mode, polygonPoints]);

  async function saveRoomName() {
    if (!selectedRoomId) return;
    setSaving(true);
    await adminFetch(`/api/layout/rooms/${selectedRoomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: roomNameDraft }),
    });
    await onLayoutChange();
    setSaving(false);
  }

  const deleteRoom = useCallback(async () => {
    if (!selectedRoomId) return;
    setSaving(true);
    await adminFetch(`/api/layout/rooms/${selectedRoomId}`, { method: "DELETE" });
    setSelectedRoomId(null);
    setRoomNameDraft("");
    await onLayoutChange();
    setSaving(false);
  }, [onLayoutChange, selectedRoomId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName ?? "";
      const inTextInput = activeTag === "INPUT" || activeTag === "TEXTAREA";

      if (event.key === "Enter" && mode === "draw-polygon" && !inTextInput) {
        event.preventDefault();
        finishPolygonShape();
      }

      if ((event.key === "Delete" || event.key === "Backspace") && mode === "select" && selectedRoom && !inTextInput) {
        event.preventDefault();
        void deleteRoom();
      }

      if (event.key === "Escape") {
        if (mode === "draw-polygon" || mode === "draw-rect") {
          event.preventDefault();
          cancelDrawingMode();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelDrawingMode, deleteRoom, finishPolygonShape, mode, selectedRoom]);

  async function uploadFloorPlan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedFloor) return;

    const reader = new FileReader();
    reader.onload = async () => {
      await adminFetch(`/api/floors/${selectedFloor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floorPlanImage: typeof reader.result === "string" ? reader.result : null }),
      });
      await onLayoutChange();
    };
    reader.readAsDataURL(file);
  }

  async function createFloor() {
    setSaving(true);
    const res = await adminFetch("/api/floors", { method: "POST" });
    if (res.ok) {
      const floor = await res.json();
      setSelectedFloorId(floor.id);
      setSelectedRoomId(null);
      setRoomNameDraft("");
    }
    await onLayoutChange();
    setSaving(false);
  }

  async function deleteFloor() {
    if (!selectedFloor) return;

    const confirmed = window.confirm(
      `Delete ${selectedFloor.name}? This will also delete its ${selectedFloor.rooms.length} room${
        selectedFloor.rooms.length === 1 ? "" : "s"
      }.`
    );
    if (!confirmed) return;

    setSaving(true);
    await adminFetch(`/api/floors/${selectedFloor.id}`, { method: "DELETE" });
    setSelectedFloorId(null);
    setSelectedRoomId(null);
    setRoomNameDraft("");
    await onLayoutChange();
    setSaving(false);
  }

  async function renameFloor(name: string) {
    if (!selectedFloor) return;
    await adminFetch(`/api/floors/${selectedFloor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await onLayoutChange();
  }

  const draftRect = draftRectStart && draftRectCurrent ? rectPoints(draftRectStart, draftRectCurrent) : null;

  return (
    <section className="ross-editor-shell">
      <aside className="ross-panel">
        <section className="ross-card">
          <div className="ross-card-head">
            <h2>1) Floors</h2>
            <button type="button" className="ross-btn ross-btn-accent" onClick={createFloor} disabled={saving}>
              <span className="ross-btn-content">
                {saving ? (
                  <>
                    <LoadingSpinner className="ross-spinner-sm" />
                    Working...
                  </>
                ) : (
                  "Add Floor"
                )}
              </span>
            </button>
          </div>
          <div className="ross-mode-row">
            {floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                className={`ross-floor-btn${selectedFloor?.id === floor.id ? " active" : ""}`}
                onClick={() => {
                  setSelectedFloorId(floor.id);
                  setSelectedRoomId(null);
                  setRoomNameDraft("");
                }}
              >
                {floor.name}
              </button>
            ))}
          </div>
        </section>

        <section className="ross-card">
          <h2>2) Floor Plan</h2>
          <label className="ross-upload">
            <input type="file" accept="image/*" onChange={uploadFloorPlan} />
            <span>Upload Image</span>
          </label>
          {selectedFloor && (
            <>
              <input
                value={selectedFloor.name}
                onChange={(event) => void renameFloor(event.target.value)}
                className="ross-text-input"
              />
              <button type="button" className="ross-btn ross-btn-danger" onClick={() => void deleteFloor()} disabled={saving}>
                Delete Floor
              </button>
            </>
          )}
          <p className="ross-hint">Upload a floor plan per floor. Rooms are drawn as overlays on top.</p>
        </section>

        <section className="ross-card">
          <h2>3) Drawing Tools</h2>
          <div className="ross-mode-row">
            <button type="button" className={`ross-mode-btn${mode === "select" ? " active" : ""}`} onClick={() => setMode("select")}>
              Select
            </button>
            <button type="button" className={`ross-mode-btn${mode === "draw-rect" ? " active" : ""}`} onClick={() => setMode("draw-rect")}>
              Draw Rectangle
            </button>
            <button type="button" className={`ross-mode-btn${mode === "draw-polygon" ? " active" : ""}`} onClick={() => setMode("draw-polygon")}>
              Draw Polygon
            </button>
            {mode !== "select" ? (
              <button
                type="button"
                className="ross-btn"
                onClick={cancelDrawingMode}
              >
                Stop Drawing
              </button>
            ) : null}
            {mode === "select" && selectedRoom ? (
              <button type="button" className="ross-btn ross-btn-danger" onClick={() => void deleteRoom()} disabled={saving}>
                Delete Selected
              </button>
            ) : null}
          </div>
          <p className="ross-hint">
            {mode === "draw-rect"
              ? "Click and drag to create a room."
              : mode === "draw-polygon"
              ? "Click to place polygon points, then finish the room (or press Enter)."
              : "Use Select mode to click, drag, or delete a room shape."}
          </p>
          {mode === "draw-polygon" && (
            <div className="ross-actions">
              <button
                type="button"
                className="ross-btn"
                onClick={finishPolygonShape}
              >
                Finish Shape
              </button>
              <button type="button" className="ross-btn" onClick={cancelDrawingMode}>
                Cancel Shape
              </button>
            </div>
          )}
        </section>

        <section className="ross-card">
          <h2>4) Selected Room</h2>
          {selectedRoom ? (
            <div className="ross-inspector">
              <div className="ross-field-group">
                <label>Room Name</label>
                <input
                  value={roomNameDraft}
                  onChange={(event) => setRoomNameDraft(event.target.value)}
                  className="ross-text-input"
                />
              </div>
              <div className="ross-actions">
                <button type="button" className="ross-btn ross-btn-primary" onClick={saveRoomName} disabled={saving}>
                  Save Room
                </button>
                <button type="button" className="ross-btn ross-btn-danger" onClick={deleteRoom} disabled={saving}>
                  Delete Room
                </button>
              </div>
            </div>
          ) : (
            <div className="ross-inspector ross-empty">Select a room to rename or delete it.</div>
          )}
        </section>
      </aside>

      <section className="ross-canvas-panel">
        <div className="ross-canvas-tools">
          <div className="ross-tool-pill">Layout Editor</div>
        </div>

        <FloorPlanCanvas
          floorPlanImage={selectedFloor?.floorPlanImage}
          floorName={selectedFloor?.name}
          placeholderText="Upload a floor plan to begin creating rooms."
          svgSize={SVG_SIZE}
          wrapperRef={canvasWrapRef}
          svgProps={{
            onPointerDown: (event) => {
              const point = getRelativePoint(event);

              if (mode === "draw-rect") {
                setDraftRectStart(point);
                setDraftRectCurrent(point);
                return;
              }

              if (mode === "draw-polygon") {
                setPolygonPoints((current) => [...current, point]);
                return;
              }

              if (mode === "select") {
                setDragState(null);
                setDragPreview(null);
              }
            },
            onPointerMove: (event) => {
              const point = getRelativePoint(event);
              if (mode === "select" && dragState) {
                const dx = point.x - dragState.startPoint.x;
                const dy = point.y - dragState.startPoint.y;
                setDragPreview({ roomId: dragState.roomId, points: offsetPoints(dragState.originalPoints, dx, dy) });
                return;
              }

              if (mode === "draw-rect" && draftRectStart) {
                setDraftRectCurrent(point);
              }
              if (mode === "draw-polygon") {
                setPolygonHover(point);
              }
            },
            onPointerUp: () => {
              if (mode === "select" && dragState) {
                const moved = !!dragPreview?.points.some((point, index) => {
                  const original = dragState.originalPoints[index];
                  if (!original) return false;
                  return Math.abs(point.x - original.x) > 0.0001 || Math.abs(point.y - original.y) > 0.0001;
                });

                if (dragPreview && moved) {
                  void moveRoom(dragPreview.roomId, dragPreview.points);
                }
                setDragState(null);
                setDragPreview(null);
                return;
              }

              if (mode === "draw-rect" && draftRect) {
                void createRoom(draftRect);
                setDraftRectStart(null);
                setDraftRectCurrent(null);
                setMode("select");
              }
            },
            onPointerLeave: () => {
              if (mode === "draw-polygon") {
                setPolygonHover(null);
              }
            },
          }}
        >
            {selectedFloor?.rooms.map((room) => {
              const roomPoints = dragPreview?.roomId === room.id ? dragPreview.points : room.points;
              const center = centroid(roomPoints);

              return (
                <g key={room.id} onClick={() => {
                  if (mode !== "select") return;
                  setSelectedRoomId(room.id);
                  setRoomNameDraft(room.name);
                }}>
                  <polygon
                    points={pointsToSvg(roomPoints)}
                    className={`ross-room-shape ross-editor-room${selectedRoomId === room.id ? " selected" : ""}`}
                    onPointerDown={(event) => {
                      if (mode !== "select") return;
                      event.stopPropagation();
                      const point = getRelativePoint(event);
                      setSelectedRoomId(room.id);
                      setRoomNameDraft(room.name);
                      setDragState({ roomId: room.id, startPoint: point, originalPoints: room.points });
                      setDragPreview({ roomId: room.id, points: room.points });
                    }}
                  />
                  <text className="ross-room-label" x={center.x * SVG_SIZE} y={center.y * SVG_SIZE}>
                    {room.name}
                  </text>
                </g>
              );
            })}

            {draftRect && (
              <polygon points={pointsToSvg(draftRect)} className="ross-draft-shape" />
            )}

            {polygonPoints.length >= 2 && (
              <polyline points={pointsToSvg(polygonHover ? [...polygonPoints, polygonHover] : polygonPoints)} className="ross-draft-shape" fill="none" />
            )}

            {polygonPoints.map((point, index) => (
              <circle key={`${point.x}-${point.y}-${index}`} cx={point.x * SVG_SIZE} cy={point.y * SVG_SIZE} r="6" className="ross-draft-vertex" />
            ))}
        </FloorPlanCanvas>
      </section>

      <aside className="ross-panel">
        <section className="ross-card">
          <h2>Rooms</h2>
          <div className={`ross-list${selectedFloor?.rooms.length ? "" : " ross-empty"}`}>
            {selectedFloor?.rooms.length ? (
              selectedFloor.rooms.map((room) => (
                <button key={room.id} type="button" className="ross-item ross-item-button" onClick={() => {
                  setSelectedRoomId(room.id);
                  setRoomNameDraft(room.name);
                }}>
                  <div className="ross-item-head">
                    <strong>{room.name}</strong>
                    <span>{room.points.length} pts</span>
                  </div>
                </button>
              ))
            ) : (
              "No rooms on this floor yet."
            )}
          </div>
        </section>
      </aside>
    </section>
  );
}
