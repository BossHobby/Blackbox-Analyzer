import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { parseBlackbox } from "@/log/parse";
import { useBlackboxStore } from "./blackbox";

const FRAMES = 4000;
const SATURATION = { start: 3000, end: 3100 };

// 1 kHz multirotor log, one frame per ms, outputs pinned to the limit for
// SATURATION frames.
function syntheticLog() {
  const entries = Array.from({ length: FRAMES }, (_, i) => {
    const out = i >= SATURATION.start && i < SATURATION.end ? 1000 : 400;
    return [i, i * 1000, [out, out, out, out]];
  });
  return JSON.stringify({
    looptime: 125,
    blackbox_rate: 8,
    profile: { meta: { name: "test" } },
    fields: [
      { name: "loop", title: "Loop", scale: 1, unit: "none" },
      { name: "time", title: "Time", scale: 1, unit: "us" },
      {
        name: "output",
        title: "Output",
        axis: ["0", "1", "2", "3"],
        scale: 1000,
        unit: "none",
      },
    ],
    entries,
  });
}

function loadSynthetic() {
  const bb = useBlackboxStore();
  const log = parseBlackbox(syntheticLog());
  bb.$patch({
    profile: log.profile,
    rate: log.rate,
    looptime: log.looptime,
    fields: Object.fromEntries(log.fields.map((f) => [f.name, f])),
    entries: log.entries,
    summary: log.summary,
  });
  bb.refreshAfterEntriesChanged();
  return bb;
}

function saturationEvent(bb: ReturnType<typeof useBlackboxStore>) {
  return bb.summary?.events.find((event) => event.kind == "saturation");
}

describe("cutEntries", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("finds the saturation burst in the full log", () => {
    const bb = loadSynthetic();
    expect(saturationEvent(bb)).toMatchObject({
      start: SATURATION.start,
      end: SATURATION.end - 1,
    });
  });

  it("re-indexes summary events after cutting the start", () => {
    const bb = loadSynthetic();
    bb.cutEntries(1000);
    expect(bb.summary?.frames).toBe(FRAMES - 1000);
    expect(saturationEvent(bb)).toMatchObject({
      start: SATURATION.start - 1000,
      end: SATURATION.end - 1 - 1000,
    });
  });

  it("drops summary events that were cut away", () => {
    const bb = loadSynthetic();
    bb.cutEntries(0, 2000);
    expect(bb.summary?.frames).toBe(2000);
    expect(saturationEvent(bb)).toBeUndefined();
    expect(bb.summary?.saturation?.fraction).toBe(0);
  });
});
