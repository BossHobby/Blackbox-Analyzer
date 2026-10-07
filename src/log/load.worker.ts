import { parseBlackbox } from "./parse";

export type LoadRequest = { blob: Blob };

self.onmessage = async (e: MessageEvent<LoadRequest>) => {
  try {
    const log = parseBlackbox(await e.data.blob.text());
    // Derived columns may alias a source column; transfer each buffer once.
    const buffers = new Set(
      Object.values(log.entries).map((column) => column.buffer),
    );
    self.postMessage({ log }, { transfer: [...buffers] });
  } catch (err) {
    self.postMessage({
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
