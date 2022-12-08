import FFTWorker from "./worker/fft?worker";

interface WorkerWrapper {
  worker: Worker;
  destroy: () => void;
}

function arrayRemove<T>(array: Array<T>, value: T) {
  const index = array.indexOf(value);
  if (index !== -1) {
    array.splice(index, 1);
  }
}

class WorkerManager {
  private static workers: Array<Worker> = [];
  private static destroyPromises: Array<Promise<void>> = [];

  public static wrap(workerCtor: new () => Worker) {
    return async (input: any) => {
      const { worker, destroy } = await WorkerManager.newWorker(workerCtor);
      return new Promise<any>((resolve, reject) => {
        worker.onmessage = (ev: any) => {
          resolve(ev.data);
          destroy();
        };

        worker.onerror = (err: any) => {
          console.warn("worker.onerror", err);
          reject(err);
          destroy();
        };

        worker.onmessageerror = (ev: any) => {
          console.warn("worker.onmessageerror", ev);
        };

        worker.postMessage(input);
      });
    };
  }

  private static newWorker(
    workerCtor: new () => Worker
  ): Promise<WorkerWrapper> {
    const maxWorkers = navigator.hardwareConcurrency - 1 || 1;
    if (this.workers.length >= maxWorkers) {
      return Promise.race(this.destroyPromises).then(() =>
        WorkerManager.newWorker(workerCtor)
      );
    }

    const res = {
      worker: new workerCtor(),
      destroy: () => {},
    };

    const destroyPromise = new Promise<void>(
      (resolve) =>
        (res.destroy = () => {
          arrayRemove(this.workers, res.worker);
          arrayRemove(this.destroyPromises, destroyPromise);
          res.worker.terminate();
          resolve();
        })
    );
    this.workers.push(res.worker);
    this.destroyPromises.push(destroyPromise);

    return Promise.resolve(res);
  }
}

export const fftWorker = WorkerManager.wrap(FFTWorker);
