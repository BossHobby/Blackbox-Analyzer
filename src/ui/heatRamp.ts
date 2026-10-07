import type { ChartTheme } from "./useChartTheme";

type RGB = [number, number, number];

function parseColor(color: string): RGB {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full =
      hex.length == 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
  }
  const parts = color.match(/[\d.]+/g)?.map(Number);
  return parts && parts.length >= 3 ? [parts[0], parts[1], parts[2]] : [0, 0, 0];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;
}

/**
 * A single-hue sequential ramp from the chart surface through the first
 * series hue towards the ink colour: darker in light mode, brighter in dark.
 */
export function heatRamp(theme: ChartTheme, steps = 256) {
  const surface = parseColor(theme.panel);
  const hue = parseColor(theme.series[0]);
  const ink = parseColor(theme.ink);
  const stops = [surface, mix(surface, hue, 0.35), hue, mix(hue, ink, 0.55)];
  const lut = new Uint8ClampedArray(steps * 3);
  for (let i = 0; i < steps; i++) {
    const pos = (i / (steps - 1)) * (stops.length - 1);
    const segment = Math.min(Math.floor(pos), stops.length - 2);
    const color = mix(stops[segment], stops[segment + 1], pos - segment);
    lut.set(color, i * 3);
  }
  return lut;
}

export function heatColor(lut: Uint8ClampedArray, t: number): RGB {
  const steps = lut.length / 3;
  const i = Math.min(Math.max(Math.round(t * (steps - 1)), 0), steps - 1);
  return [lut[i * 3], lut[i * 3 + 1], lut[i * 3 + 2]];
}
