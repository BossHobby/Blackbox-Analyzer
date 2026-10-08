export type ThrottleBand = 0 | 1 | 2;

/** Centred moving average, so per-frame bands follow the flight not the noise. */
export function smoothThrottle(values: Float32Array, window: number) {
  const out = new Float32Array(values.length);
  const half = Math.max(Math.floor(window / 2), 0);
  let sum = 0;
  let from = 0;
  let to = 0; // exclusive
  for (let i = 0; i < values.length; i++) {
    const lo = Math.max(i - half, 0);
    const hi = Math.min(i + half + 1, values.length);
    while (to < hi) sum += values[to++];
    while (from < lo) sum -= values[from++];
    out[i] = sum / (to - from);
  }
  return out;
}

/** Throttle values splitting the frames into equal-time thirds. */
export function throttleTerciles(smoothed: Float32Array): [number, number] {
  if (!smoothed.length) return [0, 0];
  const sorted = Float32Array.from(smoothed).sort();
  const at = (q: number) =>
    sorted[Math.min(Math.floor(q * sorted.length), sorted.length - 1)];
  return [at(1 / 3), at(2 / 3)];
}

/** 1 where the frame is in `band` and, when given, `base` is set. */
export function throttleBandMask(
  smoothed: Float32Array,
  edges: [number, number],
  band: ThrottleBand,
  base?: Uint8Array,
) {
  const mask = new Uint8Array(smoothed.length);
  for (let i = 0; i < smoothed.length; i++) {
    const value = smoothed[i];
    const inBand =
      band == 0
        ? value < edges[0]
        : band == 1
          ? value >= edges[0] && value < edges[1]
          : value >= edges[1];
    mask[i] = inBand && (!base || base[i]) ? 1 : 0;
  }
  return mask;
}
