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

export function unitBlackbox(field: BlackboxFieldDef) {
  switch (field.unit) {
    case BlackboxFieldUnit.RADIANS:
      return "deg";

    case BlackboxFieldUnit.US:
      return "us";

    default:
      return "";
  }
}

function processEntries(entries: any[], fields: BlackboxFieldDef[]) {
  const rawEntries = entries.filter((entry: any[], index: number) => {
    if (entry.length != fields.length) {
      console.warn("invalid entry at", index, "of", entries.length);
      return false;
    }
    return true;
  });

  const startLoop = rawEntries[0][0];
  const endLoop = rawEntries[rawEntries.length - 1][0];

  const fullEntries = [rawEntries[0]];
  for (let i = startLoop + 1, rawEntryIndex = 1; i < endLoop; i++) {
    const rawEntry = rawEntries[rawEntryIndex];
    if (rawEntry[0] == i) {
      fullEntries.push(rawEntry);
      rawEntryIndex++;
    } else {
      fullEntries.push(fullEntries[fullEntries.length - 1]);
    }
  }
  return fullEntries;
}

export const useBlackboxStore = defineStore("blackbox", {
  state: () => ({
    rate: 0,
    looptime: 0,
    duration: 0,
    filename: "",
    start: 0,
    end: -1,
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

      const generateOption = (field: BlackboxFieldDef) => {
        if (!Array.isArray(field?.axis)) {
          options[0].push({
            ...field,
            id: { name: field.name } as BlackboxFieldID,
          });
          return;
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
      };

      for (const field of fields) {
        generateOption(field);
      }
      generateOption({
        name: "pid_sum",
        scale: 3000,
        title: "Pid Sum",
        unit: BlackboxFieldUnit.NONE,
        axis: ["Roll", "Pitch", "Yaw"],
      });

      generateOption({
        name: "setpoint_error",
        scale: 3000,
        title: "Setpoint Error",
        unit: BlackboxFieldUnit.RADIANS,
        axis: ["Roll", "Pitch", "Yaw"],
      });

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
      this.start = 0;
      this.end = -1;
      this.fields = blackbox.fields.reduce(
        (prev: any, curr: BlackboxFieldDef) => {
          prev[curr.name] = curr;
          return prev;
        },
        {}
      );

      const entries = {} as { [index: string]: Float32Array };
      const rawEntries = processEntries(blackbox.entries, blackbox.fields);
      for (const [fieldIndex, field] of Object.values(this.fields).entries()) {
        let fields = [{ name: field.name } as BlackboxFieldID];
        if (field.axis) {
          fields = field.axis.map((_, index) => {
            return { name: field.name, index } as BlackboxFieldID;
          });
        }
        for (const id of fields) {
          const values = rawEntries.map((entry: any[]) => {
            let val = entry[fieldIndex];
            if (id.index != undefined) {
              val = val[id.index];
            }
            return val;
          });

          entries[blackboxFieldIDToString(id)] = Float32Array.from(values);
        }
      }
      for (let axis = 0; axis < 3; axis++) {
        entries[`pid_sum_${axis}`] = entries.time.map((_, index) => {
          return (
            entries[`pid_pterm_${axis}`][index] +
            entries[`pid_iterm_${axis}`][index] +
            entries[`pid_dterm_${axis}`][index]
          );
        });

        entries[`setpoint_error_${axis}`] = entries.time.map((_, index) => {
          return (
            entries[`setpoint_${axis}`][index] -
            entries[`gyro_filter_${axis}`][index]
          );
        });
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
    cutEntries(end: number) {
      for (const key of Object.keys(this.entries)) {
        this.entries[key] = this.entries[key].slice(0, end);
      }

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
