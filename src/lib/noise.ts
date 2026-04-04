export type NoiseLevel = {
  name: string;
  className: string;
  range: [number, number];
};

export const NOISE_LEVELS: NoiseLevel[] = [
  { name: "Quiet", className: "level-green", range: [0, 19] },
  { name: "Calm", className: "level-blue", range: [20, 39] },
  { name: "Moderate", className: "level-yellow", range: [40, 59] },
  { name: "Busy", className: "level-orange", range: [60, 79] },
  { name: "Loud", className: "level-red", range: [80, 100] },
];

export function clampNoise(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function levelFromValue(value: number) {
  const normalized = clampNoise(value);
  return NOISE_LEVELS.find((level) => normalized >= level.range[0] && normalized <= level.range[1]) ?? NOISE_LEVELS[0];
}

export function heatColor(value: number, alpha = 0.35) {
  const normalized = clampNoise(value) / 100;
  const hue = 120 - normalized * 120;
  const opacity = Math.max(0, Math.min(1, alpha));
  return `hsla(${hue}, 90%, 52%, ${opacity})`;
}

function hash(input: string) {
  return input.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function pseudoRandom(seed: number) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

export function predictedHourlyAverage(roomName: string, floor: number, day: string, hour24: number) {
  const dayScore = day.charCodeAt(0) + day.charCodeAt(day.length - 1);
  const seed = hash(roomName) + floor * 47 + dayScore * 17 + hour24 * 31;
  return clampNoise(pseudoRandom(seed) * 100);
}

export function formatNoisePercent(value: number | null | undefined) {
  if (value == null) return "No data";
  return `${clampNoise(value)}%`;
}
