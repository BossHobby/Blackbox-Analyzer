export default null;

function hamming(i: number, N: number) {
  return 0.54 - 0.46 * Math.cos((6.283185307179586 * i) / (N - 1));
}

function hammingWindow(signal: number[]) {
  const n = signal.length;
  for (let i = n - 1; i >= 0; i--) {
    signal[i] *= hamming(i, n);
  }
  return signal;
}

async function runFFT(sampleFrequency: number, input: number[]) {
  const kissfft = await import("kissfft-wasm");

  const NC = 2.0 / (sampleFrequency * 1000 * input.length);

  const windowedInput = hammingWindow(input);
  const freq = kissfft.rfft(windowedInput as any);

  const res = {
    min: Infinity,
    max: 0,
    range: 0,
    power: new Array(freq.length / 4),
  };

  for (let i = 0; i < res.power.length; i++) {
    const re = freq[i * 2];
    const im = freq[i * 2 + 1];
    const real = Math.sqrt(re * re + im * im);

    let val = Math.pow(Math.abs(real), 2) * NC;
    if (val != 0) {
      val = 10 * Math.log10(val);
    }

    res.power[i] = val;
    res.min = Math.min(res.min, val);
    res.max = Math.max(res.max, val);
    res.range = Math.max(res.range, Math.abs(val));
  }

  self.postMessage(res);
}

self.onmessage = (e) => {
  const sampleFrequency = Number(e.data.sampleFrequency);
  const input = e.data.input as number[];
  runFFT(sampleFrequency, input);
};
