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

export type AnalysisJob =
  | { op: "fft"; sampleFrequency: number; input: Float32Array }
  | {
      op: "spectrogram";
      sampleFrequency: number;
      fftLen: number;
      hop: number;
      input: Float32Array;
    }
  | {
      op: "step";
      sampleFrequency: number;
      minInput: number;
      input: Float32Array;
      output: Float32Array;
    };

function run(wasm: Analysis, job: AnalysisJob): [any, Transferable[]] {
  switch (job.op) {
    case "fft": {
      const res = wasm.fft(job.sampleFrequency, job.input);
      // serde hands back a plain number array; a typed array transfers for
      // free and stays out of Vue's deep reactivity on the main thread.
      const power = Float32Array.from(res.power);
      return [{ ...res, power }, [power.buffer]];
    }
    case "spectrogram": {
      const power = wasm.spectrogram(
        job.sampleFrequency,
        job.fftLen,
        job.hop,
        job.input,
      );
      return [power, [power.buffer]];
    }
    case "step": {
      const res = wasm.step_response(
        job.sampleFrequency,
        job.minInput,
        job.input,
        job.output,
      );
      const step = {
        ...res,
        mean: Float32Array.from(res.mean),
        low: Float32Array.from(res.low),
        high: Float32Array.from(res.high),
      };
      return [step, [step.mean.buffer, step.low.buffer, step.high.buffer]];
    }
  }
}

self.onmessage = async (e: MessageEvent<AnalysisJob>) => {
  try {
    const [result, transfer] = run(await getAnalysis(), e.data);
    self.postMessage({ result }, transfer);
  } catch (err) {
    self.postMessage({
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
