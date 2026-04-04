"use client";

import { RoomDef, MAP_WIDTH, MAP_HEIGHT, dbToStatus, statusToFill } from "@/lib/rooms";

export interface RoomWithReading extends RoomDef {
  reading: { dbLevel: number; occupants: string[]; updatedAt: string } | null;
}

interface Props {
  rooms: RoomWithReading[];
  selectedRoom: string | null;
  onSelect: (number: string) => void;
}

export function CampusMap({ rooms, selectedRoom, onSelect }: Props) {
  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      className="w-full h-full"
      style={{ maxHeight: "100%" }}
    >
      {/* Background */}
      <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#0a0a0a" />

      {/* North / South entrance labels */}
      <text x={490} y={18} textAnchor="middle" fontSize={14} fill="#525252" fontFamily="Inter, sans-serif">
        North Entrance ↑
      </text>
      <text x={490} y={648} textAnchor="middle" fontSize={14} fill="#525252" fontFamily="Inter, sans-serif">
        South Entrance ↓
      </text>

      {rooms.map((room) => {
        const status = dbToStatus(room.reading?.dbLevel ?? null);
        const colors = statusToFill(status);
        const isSelected = selectedRoom === room.number;

        const sharedProps = {
          fill: colors.fill,
          stroke: isSelected ? "#ffffff" : colors.stroke,
          strokeWidth: isSelected ? 3 : 1.5,
          onClick: () => onSelect(room.number),
          style: { cursor: "pointer" },
        };

        return (
          <g key={room.number}>
            {room.shape.type === "rect" ? (
              <rect
                x={room.shape.x}
                y={room.shape.y}
                width={room.shape.w}
                height={room.shape.h}
                rx={4}
                {...sharedProps}
              />
            ) : (
              <polygon points={room.shape.points} {...sharedProps} />
            )}

            {/* Room name */}
            <text
              x={room.labelX}
              y={room.labelY - 8}
              textAnchor="middle"
              fontSize={11}
              fontWeight="600"
              fill={colors.label}
              fontFamily="Inter, sans-serif"
              style={{ pointerEvents: "none" }}
            >
              {room.name.length > 18 ? room.name.slice(0, 17) + "…" : room.name}
            </text>

            {/* Occupant count or dB */}
            {room.reading && (
              <text
                x={room.labelX}
                y={room.labelY + 10}
                textAnchor="middle"
                fontSize={10}
                fill={colors.label}
                opacity={0.75}
                fontFamily="Inter, sans-serif"
                style={{ pointerEvents: "none" }}
              >
                {room.reading.dbLevel.toFixed(0)} dB
                {room.reading.occupants.length > 0
                  ? ` · ${room.reading.occupants.length} person${room.reading.occupants.length !== 1 ? "s" : ""}`
                  : ""}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
