// Control-relevant band: well below the filter cutoffs, around where the
// loop crosses over. Below ~10 Hz stick motion dominates and phase is tiny.
const DELAY_FREQS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const MIN_COHERENCE = 0.6;

/**
 * Phase delay of `output` behind `input` in ms, averaged over DELAY_FREQS
 * weighted by cross-spectral power. Uses one-second Hann segments, so each
 * frequency falls on an exact DFT bin. Undefined when no frequency is coherent
 * enough to trust.
 */
export function phaseDelayMs(
  sampleFrequency: number,
  input: ArrayLike<number>,
  output: ArrayLike<number>,
  freqs = DELAY_FREQS,
) {
  const segment = Math.round(sampleFrequency);
  const n = Math.min(input.length, output.length);
  const usable = freqs.filter((f) => f < sampleFrequency / 2);
  if (!segment || n < segment || !usable.length) {
    return undefined;
  }

  const window = Float64Array.from(
    { length: segment },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / segment),
  );
  const cos = usable.map((f) =>
    Float64Array.from(
      window,
      (w, i) => w * Math.cos((2 * Math.PI * f * i) / segment),
    ),
  );
  const sin = usable.map((f) =>
    Float64Array.from(
      window,
      (w, i) => w * Math.sin((2 * Math.PI * f * i) / segment),
    ),
  );

  // Accumulated auto and cross spectra per frequency.
  const sxx = new Float64Array(usable.length);
  const syy = new Float64Array(usable.length);
  const sxyRe = new Float64Array(usable.length);
  const sxyIm = new Float64Array(usable.length);

  for (let start = 0; start + segment <= n; start += segment) {
    for (let k = 0; k < usable.length; k++) {
      let xr = 0,
        xi = 0,
        yr = 0,
        yi = 0;
      for (let i = 0; i < segment; i++) {
        const x = input[start + i];
        const y = output[start + i];
        xr += x * cos[k][i];
        xi -= x * sin[k][i];
        yr += y * cos[k][i];
        yi -= y * sin[k][i];
      }
      sxx[k] += xr * xr + xi * xi;
      syy[k] += yr * yr + yi * yi;
      // conj(X) * Y
      sxyRe[k] += xr * yr + xi * yi;
      sxyIm[k] += xr * yi - xi * yr;
    }
  }

  let sum = 0;
  let weight = 0;
  for (let k = 0; k < usable.length; k++) {
    const power = Math.hypot(sxyRe[k], sxyIm[k]);
    if (!power || (power * power) / (sxx[k] * syy[k]) < MIN_COHERENCE) {
      continue;
    }
    const phase = -Math.atan2(sxyIm[k], sxyRe[k]);
    sum += (phase / (2 * Math.PI * usable[k])) * 1000 * power;
    weight += power;
  }
  return weight ? sum / weight : undefined;
}
