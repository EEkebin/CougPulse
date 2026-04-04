export type RoomShape = "default" | "angled" | "slim" | "tiny";

export type RoomDefinition = {
  id: string;
  name: string;
  floor: number;
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: RoomShape;
};

export type FloorSegment = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FloorLayout = {
  floor: number;
  rooms: RoomDefinition[];
  corridors: FloorSegment[];
  stairs: FloorSegment;
};

function roomId(floor: number, name: string) {
  return `floor-${floor}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function room(floor: number, name: string, x: number, y: number, w: number, h: number, shape?: RoomShape): RoomDefinition {
  return { id: roomId(floor, name), floor, name, x, y, w, h, shape };
}

export const FLOORS: Record<number, FloorLayout> = {
  1: {
    floor: 1,
    rooms: [
      room(1, "Rm 101", 15, 73, 17, 14),
      room(1, "Rm 102", 18, 48, 16, 20, "angled"),
      room(1, "Rm 115", 49, 20, 14, 30),
      room(1, "Rm 151", 61, 36, 11, 14),
      room(1, "Rm 155", 73, 36, 12, 14),
      room(1, "Rm 157", 86, 36, 12, 14),
      room(1, "Rm 156", 68, 72, 14, 15),
      room(1, "Rm 158", 84, 72, 14, 15),
    ],
    corridors: [
      { x: 48, y: 52, w: 50, h: 8 },
      { x: 60, y: 24, w: 4, h: 28 },
      { x: 33, y: 58, w: 16, h: 8 },
    ],
    stairs: { x: 44, y: 14, w: 8, h: 10 },
  },
  2: {
    floor: 2,
    rooms: [
      room(2, "Study Hall", 24, 52, 9, 12, "angled"),
      room(2, "Rm 200", 35, 21, 9, 37, "slim"),
      room(2, "Rm 251", 56, 38, 13, 14),
      room(2, "Rm 255", 69, 38, 10, 14),
      room(2, "Rm 257", 79, 38, 13, 14),
      room(2, "Rm 261", 92, 38, 3.8, 14, "tiny"),
      room(2, "Rm 263", 95.8, 38, 3.6, 14, "tiny"),
      room(2, "Rm 254", 57, 71, 17, 16),
      room(2, "Rm 256", 74, 71, 17, 16),
    ],
    corridors: [
      { x: 54, y: 53, w: 45, h: 7 },
      { x: 52, y: 36, w: 4, h: 24 },
      { x: 44, y: 58, w: 10, h: 8 },
      { x: 34, y: 58, w: 10, h: 7 },
    ],
    stairs: { x: 45, y: 37, w: 7, h: 13 },
  },
  3: {
    floor: 3,
    rooms: [
      room(3, "Rm 355", 66, 38, 16, 14),
      room(3, "Rm 357", 82, 38, 15, 14),
      room(3, "Rm 361", 97, 38, 3, 14, "tiny"),
      room(3, "Rm 363", 94, 38, 3, 14, "tiny"),
      room(3, "Rm 354", 64, 71, 15, 16),
      room(3, "Rm 356", 79, 71, 11, 16),
      room(3, "Rm 358", 90, 71, 9, 16),
      room(3, "Rm 340", 49.5, 77, 4.5, 10, "tiny"),
    ],
    corridors: [
      { x: 54, y: 53, w: 46, h: 7 },
      { x: 50, y: 62, w: 4, h: 15 },
      { x: 54, y: 71, w: 10, h: 6 },
      { x: 50, y: 36, w: 4, h: 24 },
    ],
    stairs: { x: 45, y: 70, w: 5, h: 17 },
  },
  4: {
    floor: 4,
    rooms: [
      room(4, "Rm 451", 64, 38, 14, 14),
      room(4, "Rm 455", 78, 38, 12, 14),
      room(4, "Rm 457", 90, 38, 6, 14),
      room(4, "Rm 461", 96, 38, 2, 14, "tiny"),
      room(4, "Rm 452", 64, 71, 12, 16),
      room(4, "Rm 456", 76, 71, 12, 16),
      room(4, "Rm 458", 88, 71, 12, 16),
      room(4, "Rm 440", 49.5, 77, 4.5, 10, "tiny"),
    ],
    corridors: [
      { x: 54, y: 53, w: 46, h: 7 },
      { x: 50, y: 62, w: 4, h: 15 },
      { x: 54, y: 71, w: 10, h: 6 },
      { x: 50, y: 36, w: 4, h: 24 },
    ],
    stairs: { x: 45, y: 70, w: 5, h: 17 },
  },
};

export const ROOMS = Object.values(FLOORS).flatMap((floor) => floor.rooms);

export const ROOM_MAP = new Map(ROOMS.map((room) => [room.id, room]));

export const ROOM_OPTIONS = ROOMS.map((room) => ({
  id: room.id,
  label: `${room.name} (Floor ${room.floor})`,
  floor: room.floor,
  name: room.name,
}));
