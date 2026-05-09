import init, { Analysis } from "@cargo/analysis";

export default null;

let wasm: Analysis | undefined;
let initPromise: Promise<Analysis> | undefined;

async function getAnalysis() {
  if (wasm) {
    return wasm;
  }

  initPromise ||= init().then(() => {
    wasm = new Analysis();
    return wasm;
  });

  return initPromise;
}

self.onmessage = async (e) => {
  const wasm = await getAnalysis();

  const sampleFrequency = Number(e.data.sampleFrequency);
  const input = e.data.input as Float32Array;
  const res = wasm.fft(sampleFrequency, input);
  self.postMessage(res);
};
