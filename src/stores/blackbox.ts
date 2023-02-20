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

export class BlackboxFieldIdentifier {
  constructor(public name: string, public index?: number) {}

  public toString() {
    if (this.index != undefined) {
      return this.name + "_" + this.index;
    }
    return this.name;
  }

  public static toString(name: string, index?: number) {
    return new BlackboxFieldIdentifier(name, index).toString();
  }
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

      for (const f of fields) {
        const field = {
          ...f,
          expo: 100,
        };

        if (!Array.isArray(field?.axis)) {
          options[0].push(field);
          continue;
        }

        const opt: any[] = [
          {
            ...field,
            title: field.title + " All",
            groupTitle: field.title,
            group: field?.axis.length,
          },
          ...field.axis.map((name, index) => {
            return {
              ...field,
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
        let fields = [new BlackboxFieldIdentifier(field.name)];
        if (field.axis) {
          fields = field.axis.map(
            (_, index) => new BlackboxFieldIdentifier(field.name, index)
          );
        }
        for (const id of fields) {
          const values = blackbox.entries.map((entry: any) => {
            let val = entry[fieldIndex];
            if (id.index != undefined) {
              val = val[id.index];
            }
            return val;
          });

          entries[id.toString()] = Float32Array.from(values);
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
