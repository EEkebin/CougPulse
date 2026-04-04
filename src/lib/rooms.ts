export interface RoomDef {
  number: string;
  name: string;
  shape:
    | { type: "rect"; x: number; y: number; w: number; h: number }
    | { type: "polygon"; points: string };
  labelX: number;
  labelY: number;
  trackable: boolean;
}

export const FLOOR_ROOMS: RoomDef[] = [
  // ── Left block ──────────────────────────────────────────────────────────
  {
    number: "lobby-enrollment",
    name: "Enrollment Services Lobby",
    shape: { type: "rect", x: 0, y: 0, w: 400, h: 185 },
    labelX: 200, labelY: 92,
    trackable: false,
  },
  {
    number: "102",
    name: "Tiered Lecture Rm 102",
    shape: { type: "polygon", points: "50,185 400,185 400,420 0,420" },
    labelX: 205, labelY: 305,
    trackable: true,
  },
  {
    number: "101",
    name: "Room 101",
    shape: { type: "rect", x: 0, y: 420, w: 400, h: 235 },
    labelX: 200, labelY: 537,
    trackable: true,
  },
  // ── Capstone center ──────────────────────────────────────────────────────
  {
    number: "115A",
    name: "Capstone Seminar 115A",
    shape: { type: "rect", x: 400, y: 0, w: 110, h: 90 },
    labelX: 455, labelY: 45,
    trackable: true,
  },
  {
    number: "115B",
    name: "Capstone Seminar 115B",
    shape: { type: "rect", x: 510, y: 0, w: 110, h: 90 },
    labelX: 565, labelY: 45,
    trackable: true,
  },
  {
    number: "115",
    name: "Capstone Studio 115",
    shape: { type: "rect", x: 400, y: 90, w: 220, h: 330 },
    labelX: 510, labelY: 255,
    trackable: true,
  },
  {
    number: "lobby-main",
    name: "Main Lobby",
    shape: { type: "rect", x: 400, y: 420, w: 110, h: 235 },
    labelX: 455, labelY: 537,
    trackable: false,
  },
  {
    number: "restrooms",
    name: "Restrooms",
    shape: { type: "rect", x: 510, y: 420, w: 110, h: 235 },
    labelX: 565, labelY: 537,
    trackable: false,
  },
  // ── Storage ──────────────────────────────────────────────────────────────
  {
    number: "152",
    name: "Storage 152",
    shape: { type: "rect", x: 620, y: 420, w: 175, h: 235 },
    labelX: 707, labelY: 537,
    trackable: false,
  },
  // ── Classrooms top row ────────────────────────────────────────────────────
  {
    number: "151",
    name: "Classroom 151",
    shape: { type: "rect", x: 620, y: 260, w: 175, h: 160 },
    labelX: 707, labelY: 340,
    trackable: true,
  },
  {
    number: "155",
    name: "Classroom 155",
    shape: { type: "rect", x: 795, y: 260, w: 175, h: 160 },
    labelX: 882, labelY: 340,
    trackable: true,
  },
  {
    number: "157",
    name: "Classroom 157",
    shape: { type: "rect", x: 970, y: 260, w: 175, h: 160 },
    labelX: 1057, labelY: 340,
    trackable: true,
  },
  // ── Classrooms bottom row ─────────────────────────────────────────────────
  {
    number: "156",
    name: "Classroom 156",
    shape: { type: "rect", x: 795, y: 420, w: 175, h: 235 },
    labelX: 882, labelY: 537,
    trackable: true,
  },
  {
    number: "158",
    name: "Classroom 158",
    shape: { type: "rect", x: 970, y: 420, w: 175, h: 235 },
    labelX: 1057, labelY: 537,
    trackable: true,
  },
  // ── Receiving ─────────────────────────────────────────────────────────────
  {
    number: "receiving",
    name: "Receiving",
    shape: { type: "rect", x: 1145, y: 260, w: 155, h: 160 },
    labelX: 1222, labelY: 340,
    trackable: false,
  },
];

export const MAP_WIDTH = 1300;
export const MAP_HEIGHT = 655;

export function dbToStatus(db: number | null) {
  if (db === null || db < -80) return "none";
  if (db < -40) return "quiet";
  if (db < -25) return "moderate";
  return "loud";
}

export function statusToFill(status: ReturnType<typeof dbToStatus>) {
  switch (status) {
    case "quiet":    return { fill: "#14532d", stroke: "#22c55e", label: "#4ade80" };
    case "moderate": return { fill: "#713f12", stroke: "#eab308", label: "#fde047" };
    case "loud":     return { fill: "#7f1d1d", stroke: "#ef4444", label: "#f87171" };
    default:         return { fill: "#1c1c1c", stroke: "#3f3f3f", label: "#737373" };
  }
}
