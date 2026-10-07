import { Analysis } from "@/analysis";

export const THROTTLE_BINS = 40;

export interface HeatmapData {
  columns: number;
  bins: number;
  // dB, column-major (column * bins + bin); NaN marks an empty column.
  values: Float32Array;
  xKind: "throttle" | "time";
  xMin: number; // throttle fraction or ms
  xMax: number;
  freqMax: number;
}


/** Linear PSD columns over time, as returned by the wasm spectrogram. */
export interface RawSpectrogram {
  power: Float32Array;
  columns: number;
  bins: number;
  hop: number;
  fftLen: number;
  sampleFrequency: number;
}

// About 4 Hz resolution at any blackbox rate, half-overlapping windows.
export function spectrogramFftLen(sampleFrequency: number) {
  return Math.max(2 ** Math.ceil(Math.log2(sampleFrequency / 4)), 32);
}

export async function computeSpectrogram(
  sampleFrequency: number,
  input: Float32Array,
): Promise<RawSpectrogram | undefined> {
  const fftLen = spectrogramFftLen(sampleFrequency);
  const hop = fftLen / 2;
  if (input.length < fftLen) {
    return undefined;
  }
  const power = await Analysis.spectrogram(sampleFrequency, fftLen, hop, input);
  const bins = fftLen / 2 + 1;
  return {
    power,
    columns: power.length / bins,
    bins,
    hop,
    fftLen,
    sampleFrequency,
  };
}

function toDb(power: number) {
  return 10 * Math.log10(power + 1e-12);
}

export function timeHeatmap(raw: RawSpectrogram, startMs: number): HeatmapData {
  const values = new Float32Array(raw.power.length);
  for (let i = 0; i < values.length; i++) values[i] = toDb(raw.power[i]);
  // Column c is centred on its window: start + c * hop + fftLen / 2.
  const msPerSample = 1000 / raw.sampleFrequency;
  const xMin = startMs + (raw.fftLen / 2 - raw.hop / 2) * msPerSample;
  return {
    columns: raw.columns,
    bins: raw.bins,
    values,
    xKind: "time",
    xMin,
    xMax: xMin + raw.columns * raw.hop * msPerSample,
    freqMax: raw.sampleFrequency / 2,
  };
}

/** Mean of `values` over each spectrogram window, e.g. throttle per column. */
export function columnMeans(raw: RawSpectrogram, values: ArrayLike<number>) {
  const sums = new Float64Array(values.length + 1);
  for (let i = 0; i < values.length; i++) sums[i + 1] = sums[i] + values[i];
  const means = new Float32Array(raw.columns);
  for (let c = 0; c < raw.columns; c++) {
    const from = c * raw.hop;
    const to = Math.min(from + raw.fftLen, values.length);
    means[c] = to > from ? (sums[to] - sums[from]) / (to - from) : 0;
  }
  return means;
}

/** Power averaged per throttle bin; bins nobody flew in stay empty. */
export function throttleHeatmap(
  raw: RawSpectrogram,
  throttle: Float32Array,
  low: number,
): HeatmapData {
  const sums = new Float64Array(THROTTLE_BINS * raw.bins);
  const counts = new Uint32Array(THROTTLE_BINS);
  for (let c = 0; c < raw.columns; c++) {
    const t = (throttle[c] - low) / (1 - low);
    const bin = Math.min(Math.max(Math.floor(t * THROTTLE_BINS), 0), THROTTLE_BINS - 1);
    counts[bin]++;
    for (let b = 0; b < raw.bins; b++) {
      sums[bin * raw.bins + b] += raw.power[c * raw.bins + b];
    }
  }
  const values = new Float32Array(THROTTLE_BINS * raw.bins).fill(NaN);
  for (let bin = 0; bin < THROTTLE_BINS; bin++) {
    if (!counts[bin]) continue;
    for (let b = 0; b < raw.bins; b++) {
      values[bin * raw.bins + b] = toDb(sums[bin * raw.bins + b] / counts[bin]);
    }
  }
  return {
    columns: THROTTLE_BINS,
    bins: raw.bins,
    values,
    xKind: "throttle",
    xMin: low,
    xMax: 1,
    freqMax: raw.sampleFrequency / 2,
  };
}

/** A shared colour range: robust percentiles over all maps' finite values. */
export function dbRange(maps: (HeatmapData | undefined)[]): [number, number] {
  const sample: number[] = [];
  for (const map of maps) {
    if (!map) continue;
    const stride = Math.max(Math.floor(map.values.length / 20000), 1);
    for (let i = 0; i < map.values.length; i += stride) {
      if (Number.isFinite(map.values[i])) sample.push(map.values[i]);
    }
  }
  if (!sample.length) {
    return [0, 1];
  }
  sample.sort((a, b) => a - b);
  const at = (q: number) => sample[Math.floor(q * (sample.length - 1))];
  const lo = at(0.02);
  const hi = at(0.995);
  return hi > lo ? [lo, hi] : [lo, lo + 1];
}
