import { defineStore } from "pinia";
import { useSpectrumStore } from "./spectrum";
import { useTimelineStore } from "./timeline";

export enum BlackboxFieldUnit {
  NONE = "none",
  US = "us",
  RADIANS = "rad",
}

export interface BlackboxFieldDef {
  name: string;
  title: string;
  scale: number;
  axis?: string[];
  unit: BlackboxFieldUnit;
}

export const useBlackboxStore = defineStore("blackbox", {
  state: () => ({
    rate: 0,
    looptime: 0,
    duration: 0,
    fields: {} as { [index: string]: BlackboxFieldDef },
    entries: [] as any[],
  }),
  getters: {
    entriesPerMS(state) {
      return 1000 / state.looptime / state.rate;
    },
  },
  actions: {
    transform(name: string, val: number) {
      const field = this.fields[name];

      switch (field.unit) {
        case BlackboxFieldUnit.RADIANS:
          return (val / field.scale) * (180 / Math.PI);

        default:
          return val / field.scale;
      }
    },
    async loadBlackbox() {
      const pickerOpts = {
        types: [
          {
            description: "Logs",
            accept: {
              "application/json": [".json"],
            },
          },
        ],
        excludeAcceptAllOption: true,
        multiple: false,
      };

      const [fileHandle] = await window.showOpenFilePicker(pickerOpts);
      const blackbox = JSON.parse(
        await fileHandle.getFile().then((f) => f.text())
      );

      this.rate = blackbox.blackbox_rate;
      this.looptime = blackbox.looptime;
      this.fields = blackbox.fields.reduce(
        (prev: any, curr: BlackboxFieldDef) => {
          prev[curr.name] = curr;
          return prev;
        },
        {}
      );

      const fieldKeys = Object.keys(this.fields);
      let entries = new Array(blackbox.entries.length);
      for (let j = 0; j < blackbox.entries.length; j++) {
        entries[j] = {};
        for (let i = 0; i < fieldKeys.length; i++) {
          entries[j][fieldKeys[i]] = blackbox.entries[j][i];
        }
        if (entries[j].time == undefined) {
          console.warn("blackbox: invalid entry", j);
          entries = entries.slice(0, j);
          break;
        }
      }
      this.entries = entries;

      this.duration =
        (this.entries[this.entries.length - 1].time - this.entries[0].time) /
        1000;

      const timeline = useTimelineStore();
      timeline.initTimeline(this.entries.length, this.duration);

      const spectrum = useSpectrumStore();
      spectrum.initSpectrum();
    },
  },
});
