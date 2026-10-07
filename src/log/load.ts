import LoadWorker from "./load.worker?worker";
import type { ParsedLog } from "./parse";

// One short-lived worker per load keeps the parsed JSON tree off the main
// thread; only the typed columns come back.
export function loadLog(blob: Blob) {
  return new Promise<ParsedLog>((resolve, reject) => {
    const worker = new LoadWorker();
    worker.onmessage = (e: MessageEvent<{ log?: ParsedLog; error?: string }>) => {
      worker.terminate();
      if (e.data.log) {
        resolve(e.data.log);
      } else {
        reject(new Error(e.data.error || "Could not load blackbox"));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "Blackbox loader crashed"));
    };
    worker.postMessage({ blob });
  });
}
