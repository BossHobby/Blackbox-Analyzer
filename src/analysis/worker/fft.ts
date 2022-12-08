import init, { Analysis } from "@cargo/analysis";

export default null;

self.onmessage = async (e) => {
  await init();
  const wasm = new Analysis();

  const sampleFrequency = Number(e.data.sampleFrequency);
  const input = e.data.input as Float32Array;
  const res = wasm.fft(sampleFrequency, input);
  self.postMessage(res);
};
