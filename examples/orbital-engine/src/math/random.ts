export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export function random(min = 0, max = 1) { return min + Math.random() * (max - min); }
export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
