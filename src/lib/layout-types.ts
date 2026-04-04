export type LayoutPoint = { x: number; y: number };

export type LayoutRoom = {
  id: string;
  floorId: string;
  name: string;
  shape: string;
  points: LayoutPoint[];
  createdAt?: string;
  updatedAt?: string;
};

export type LayoutFloor = {
  id: string;
  name: string;
  sortOrder: number;
  floorPlanImage: string | null;
  rooms: LayoutRoom[];
  createdAt?: string;
  updatedAt?: string;
};
