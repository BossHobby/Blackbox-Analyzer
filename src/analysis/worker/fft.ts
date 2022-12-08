import { Analysis } from "..";

export default null;

self.onmessage = async (e) => {
  await Analysis.init();
  const sampleFrequency = Number(e.data.sampleFrequency);
  const input = e.data.input as Float32Array;
  const res = Analysis.wasm.fft(sampleFrequency, input);
  self.postMessage(res);
};
