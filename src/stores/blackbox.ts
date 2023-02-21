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

export interface BlackboxFieldID {
  name: string;
  index?: number;
}

export function blackboxFieldIDToString(id: BlackboxFieldID) {
  if (id.index != undefined) {
    return id.name + "_" + id.index;
  }
  return id.name;
}

export function transformBlackbox(field: BlackboxFieldDef, val: number) {
  switch (field.unit) {
    case BlackboxFieldUnit.RADIANS:
      return (val / field.scale) * (180 / Math.PI);

    default:
      return val / field.scale;
  }
}

export const useBlackboxStore = defineStore("blackbox", {
  state: () => ({
    rate: 0,
    looptime: 0,
    duration: 0,
    filename: "",
    fields: {} as { [index: string]: BlackboxFieldDef },
    entries: {} as { [index: string]: Float32Array },
  }),
  getters: {
    entriesPerMS(state) {
      return 1000 / state.looptime / state.rate;
    },
    fieldOptions() {
      const options = [[]] as any[];
      const fields = Object.values(this.fields);

      for (const field of fields) {
        if (!Array.isArray(field?.axis)) {
          options[0].push({
            ...field,
            id: { name: field.name } as BlackboxFieldID,
          });
          continue;
        }

        const opt: any[] = [
          {
            ...field,
            id: { name: field.name } as BlackboxFieldID,
            title: field.title + " All",
            groupTitle: field.title,
            group: field?.axis.length,
          },
          ...field.axis.map((name, index) => {
            return {
              ...field,
              id: { name: field.name, index } as BlackboxFieldID,
              title: field.title + " " + name,
              index,
            };
          }),
        ];
        options.push(opt);
      }

      return options;
    },
  },
  actions: {
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

      this.filename = fileHandle.name;
      this.rate = blackbox.blackbox_rate;
      this.looptime = blackbox.looptime;
      this.fields = blackbox.fields.reduce(
        (prev: any, curr: BlackboxFieldDef) => {
          prev[curr.name] = curr;
          return prev;
        },
        {}
      );

      const entries = {} as { [index: string]: Float32Array };
      for (const [fieldIndex, field] of Object.values(this.fields).entries()) {
        let fields = [{ name: field.name } as BlackboxFieldID];
        if (field.axis) {
          fields = field.axis.map((_, index) => {
            return { name: field.name, index } as BlackboxFieldID;
          });
        }
        for (const id of fields) {
          const values = blackbox.entries
            .filter((entry: any[], index: number) => {
              if (entry.length != blackbox.fields.length) {
                console.warn(
                  "invalid entry at",
                  index,
                  "of",
                  blackbox.entries.length
                );
                return false;
              }
              return true;
            })
            .map((entry: any[]) => {
              let val = entry[fieldIndex];
              if (id.index != undefined) {
                val = val[id.index];
              }
              return val;
            });

          entries[blackboxFieldIDToString(id)] = Float32Array.from(values);
        }
      }
      this.entries = entries;

      this.duration =
        (this.entries.time[this.entries.time.length - 1] -
          this.entries.time[0]) /
        1000;

      const timeline = useTimelineStore();
      timeline.initTimeline(this.entries.time.length, this.duration);

      const spectrum = useSpectrumStore();
      spectrum.initSpectrum();
    },
  },
});
