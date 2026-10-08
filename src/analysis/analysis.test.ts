import { describe, expect, it } from "vitest";
import { phaseDelayMs } from "./delay";
import {
  smoothThrottle,
  throttleBandMask,
  throttleTerciles,
} from "./throttle";

// Deterministic band-limited "stick motion": a seeded random walk.
function motion(n: number, seed = 1) {
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31 - 0.5;
  const out = new Float32Array(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    v = v * 0.995 + rand();
    out[i] = v;
  }
  return out;
}

describe("filter delay", () => {
  const fs = 1000;

  it("recovers a pure sample shift", () => {
    const input = motion(20000);
    const output = new Float32Array(input.length);
    for (let i = 3; i < output.length; i++) output[i] = input[i - 3];
    expect(phaseDelayMs(fs, input, output)).toBeCloseTo(3, 1);
  });

  it("matches the low-frequency delay of a PT1", () => {
    const cutoff = 80;
    const input = motion(60000);
    const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / fs);
    const output = new Float32Array(input.length);
    for (let i = 1; i < output.length; i++) {
      output[i] = output[i - 1] + alpha * (input[i] - output[i - 1]);
    }
    // Analytic phase delay of this discrete PT1 at 30 Hz, mid-band.
    const pole = 1 - alpha;
    const w = (2 * Math.PI * 30) / fs;
    const phase = Math.atan2(pole * Math.sin(w), 1 - pole * Math.cos(w));
    const expected = (phase / w / fs) * 1000;
    expect(phaseDelayMs(fs, input, output)).toBeCloseTo(expected, 1);
  });

  it("gives up on unrelated signals", () => {
    expect(
      phaseDelayMs(fs, motion(20000, 1), motion(20000, 7)),
    ).toBeUndefined();
  });
});

describe("throttle bands", () => {
  it("smooths with a centred window", () => {
    expect([...smoothThrottle(Float32Array.of(0, 0, 3, 0, 0), 3)]).toEqual([
      0, 1, 1, 1, 0,
    ]);
  });

  it("splits frames into thirds and honours the base mask", () => {
    const values = Float32Array.from({ length: 9 }, (_, i) => i / 10);
    const edges = throttleTerciles(values);
    expect(edges).toEqual([values[3], values[6]]);
    const base = Uint8Array.of(1, 1, 1, 1, 0, 1, 1, 1, 1);
    expect([...throttleBandMask(values, edges, 0)]).toEqual([
      1, 1, 1, 0, 0, 0, 0, 0, 0,
    ]);
    expect([...throttleBandMask(values, edges, 1, base)]).toEqual([
      0, 0, 0, 1, 0, 1, 0, 0, 0,
    ]);
    expect([...throttleBandMask(values, edges, 2)]).toEqual([
      0, 0, 0, 0, 0, 0, 1, 1, 1,
    ]);
  });
});
