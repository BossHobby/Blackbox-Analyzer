import init, { Analysis as WasmAnalysis } from "@cargo/analysis";
import { fftWorker } from "./worker";

export class Analysis {
  public static wasm: WasmAnalysis;

  public static async init() {
    await init();
    Analysis.wasm = new WasmAnalysis();
  }

  public static fft(sampleFrequency: number, input: Float32Array) {
    return fftWorker({ sampleFrequency, input });
  }

  public static decimate(width: number, input: Float32Array) {
    return Analysis.wasm.decimate(width, input);
  }

  public static transform(expo: number, window: number, input: Float32Array) {
    return Analysis.wasm.transform(expo, window, input);
  }
}
