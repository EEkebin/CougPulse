// Room definitions — pixel coordinates on the 1386×770 floor plan image.
// x, y = top-left corner of the room rectangle; w, h = dimensions.
// Adjust these values if the overlays don't line up perfectly with the map.

export type Room = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export const MAP_W = 1386;
export const MAP_H = 770;

export const ROOMS: Room[] = [
  { id: "enrollment-lobby",  name: "Enrollment Services Lobby", x: 90,   y: 35,  w: 200, h: 155 },
  { id: "tiered-lecture",    name: "Tiered Lecture Room",        x: 20,   y: 190, w: 275, h: 365 },
  { id: "room-161",          name: "Room 161",                   x: 20,   y: 555, w: 195, h: 175 },
  { id: "capstone-studio",   name: "Capstone Studio",            x: 300,  y: 35,  w: 375, h: 380 },
  { id: "main-lobby",        name: "Main Lobby",                 x: 230,  y: 555, w: 455, h: 175 },
  { id: "hallway",           name: "Main Hallway",               x: 685,  y: 415, w: 680, h: 140 },
  { id: "classroom-a",       name: "Classroom A",                x: 685,  y: 35,  w: 155, h: 190 },
  { id: "classroom-b",       name: "Classroom B",                x: 840,  y: 35,  w: 160, h: 190 },
  { id: "classroom-c",       name: "Classroom C",                x: 1000, y: 35,  w: 165, h: 190 },
  { id: "classroom-d",       name: "Classroom D",                x: 1165, y: 35,  w: 195, h: 190 },
  { id: "classroom-e",       name: "Classroom E",                x: 685,  y: 225, w: 155, h: 190 },
  { id: "classroom-f",       name: "Classroom F",                x: 840,  y: 225, w: 160, h: 190 },
  { id: "classroom-g",       name: "Classroom G",                x: 1000, y: 225, w: 165, h: 190 },
  { id: "restrooms",         name: "Restrooms",                  x: 1165, y: 225, w: 195, h: 190 },
];
