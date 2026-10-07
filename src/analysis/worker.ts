import FFTWorker from "./worker/fft?worker";
import type { AnalysisJob } from "./worker/fft";

type WorkerJob = {
  input: any;
  resolve: (value: any) => void;
  reject: (err: any) => void;
};

type WorkerSlot = {
  worker: Worker;
  current?: WorkerJob;
};

function arrayRemove<T>(array: Array<T>, value: T) {
  const index = array.indexOf(value);
  if (index !== -1) {
    array.splice(index, 1);
  }
}

class WorkerPool {
  private readonly maxWorkers = Math.max(
    (navigator.hardwareConcurrency || 1) - 1,
    1,
  );
  private readonly slots: WorkerSlot[] = [];
  private readonly queue: WorkerJob[] = [];

  public constructor(
    private readonly workerCtor: new () => Worker,
    private readonly transfer?: (input: any) => Transferable[],
  ) {}

  public run(input: any) {
    return new Promise<any>((resolve, reject) => {
      this.queue.push({ input, resolve, reject });
      this.drain();
    });
  }

  private drain() {
    while (this.queue.length) {
      const slot = this.idleSlot() || this.createSlot();
      if (!slot) {
        return;
      }

      const job = this.queue.shift()!;
      slot.current = job;
      slot.worker.postMessage(job.input, this.transfer?.(job.input) || []);
    }
  }

  private idleSlot() {
    return this.slots.find((slot) => !slot.current);
  }

  private createSlot() {
    if (this.slots.length >= this.maxWorkers) {
      return undefined;
    }

    const slot: WorkerSlot = { worker: new this.workerCtor() };
    slot.worker.onmessage = (ev: MessageEvent) => {
      if (ev.data?.error != undefined) {
        slot.current?.reject(new Error(ev.data.error));
      } else {
        slot.current?.resolve(ev.data?.result);
      }
      slot.current = undefined;
      this.drain();
    };
    slot.worker.onerror = (err: ErrorEvent) => {
      console.warn("worker.onerror", err);
      slot.current?.reject(err);
      slot.worker.terminate();
      arrayRemove(this.slots, slot);
      this.drain();
    };
    slot.worker.onmessageerror = (ev: MessageEvent) => {
      console.warn("worker.onmessageerror", ev);
      slot.current?.reject(ev);
      slot.current = undefined;
      this.drain();
    };

    this.slots.push(slot);
    return slot;
  }
}

// Inputs are copies made for the job, so their buffers can move to the worker.
const analysisPool = new WorkerPool(FFTWorker, (job) =>
  [job.input, job.output]
    .filter((value) => value instanceof Float32Array)
    .map((value) => value.buffer),
);

export const analysisWorker = (job: AnalysisJob) => analysisPool.run(job);
