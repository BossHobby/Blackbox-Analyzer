import init, { Analysis as WasmAnalysis } from "@cargo/analysis";
import { analysisWorker } from "./worker";

export interface StepResponse {
  windows: number;
  candidates: number;
  mean: Float32Array;
  low: Float32Array;
  high: Float32Array;
}

export class Analysis {
  public static wasm: WasmAnalysis;

  public static async init() {
    await init();
    Analysis.wasm = new WasmAnalysis();
  }

  public static fft(sampleFrequency: number, input: Float32Array) {
    return analysisWorker({ op: "fft", sampleFrequency, input });
  }

  /** Columns of `fftLen / 2 + 1` linear PSD bins, one per `hop` samples. */
  public static spectrogram(
    sampleFrequency: number,
    fftLen: number,
    hop: number,
    input: Float32Array,
  ): Promise<Float32Array> {
    return analysisWorker({
      op: "spectrogram",
      sampleFrequency,
      fftLen,
      hop,
      input,
    });
  }

  public static stepResponse(
    sampleFrequency: number,
    minInput: number,
    input: Float32Array,
    output: Float32Array,
    // 1 where the controller tracks setpoint; empty when all frames do.
    closedLoop = new Uint8Array(),
  ): Promise<StepResponse> {
    return analysisWorker({
      op: "step",
      sampleFrequency,
      minInput,
      input,
      output,
      closedLoop,
    });
  }

  public static decimate(width: number, input: Float32Array) {
    return Analysis.wasm.decimate(width, input);
  }

  public static transform(expo: number, window: number, input: Float32Array) {
    return Analysis.wasm.transform(expo, window, input);
  }
}
