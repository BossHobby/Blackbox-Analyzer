import { defineStore } from "pinia";
import { useSpectrumStore } from "./spectrum";
import { useTimelineStore } from "./timeline";

export enum BlackboxFieldUnit {
  NONE = "none",
  US = "us",
  RADIANS = "rad",
}

export enum BlackboxLoadState {
  EMPTY = "empty",
  LOADING = "loading",
  LOADED = "loaded",
  ERROR = "error",
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

interface PickedBlackboxFile {
  name: string;
  text: string;
}

const AXIS_NAMES = ["Roll", "Pitch", "Yaw"];
const ROVER_DEBUG_FIELDS = [
  "Mode",
  "Throttle Assist Target",
  "Throttle Assist Filtered",
  "Throttle Assist Clamp",
  "Steering Clamp",
  "Throttle Assist Active",
];

export function blackboxFieldIDToString(id: BlackboxFieldID) {
  if (id.index != undefined) {
    return id.name + "_" + id.index;
  }
  return id.name;
}

export function transformBlackbox(field: BlackboxFieldDef, val: number) {
  const scale = field.scale || 1;
  switch (field.unit) {
    case BlackboxFieldUnit.RADIANS:
      return (val / scale) * (180 / Math.PI);

    default:
      return val / scale;
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

export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0.00 s";
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds.toFixed(0)}s`;
}

function processEntries(entries: any[], fields: BlackboxFieldDef[]) {
  let lastEntry: any[] | undefined;
  const rawEntries = entries.reduce((validEntries: any[], entry: any[]) => {
    if (!Array.isArray(entry) || entry.length != fields.length) {
      if (lastEntry) {
        validEntries.push(lastEntry);
      }
      return validEntries;
    }
    lastEntry = entry;
    validEntries.push(entry);
    return validEntries;
  }, []);

  if (!rawEntries.length) {
    return [];
  }

  const startLoop = rawEntries[0][0];
  const endLoop = rawEntries[rawEntries.length - 1][0];

  if (!Number.isFinite(startLoop) || !Number.isFinite(endLoop)) {
    return rawEntries;
  }

  const fullEntries = [rawEntries[0]];
  for (let i = startLoop + 1, rawEntryIndex = 1; i <= endLoop; i++) {
    while (rawEntries[rawEntryIndex]?.[0] < i) {
      rawEntryIndex++;
    }

    const rawEntry = rawEntries[rawEntryIndex];
    if (rawEntry?.[0] == i) {
      fullEntries.push(rawEntry);
      rawEntryIndex++;
    } else {
      fullEntries.push(fullEntries[fullEntries.length - 1]);
    }
  }
  return fullEntries;
}

function validateBlackboxFile(blackbox: any) {
  if (!blackbox || typeof blackbox != "object") {
    throw new Error("Invalid blackbox file");
  }
  if (!Array.isArray(blackbox.fields) || !Array.isArray(blackbox.entries)) {
    throw new Error("Blackbox file is missing fields or entries");
  }
  if (!blackbox.fields.length || !blackbox.entries.length) {
    throw new Error("Blackbox file does not contain any log entries");
  }
  if (
    !Number.isFinite(blackbox.blackbox_rate) ||
    !Number.isFinite(blackbox.looptime)
  ) {
    throw new Error("Blackbox file has invalid timing metadata");
  }
}

async function pickBlackboxFile(): Promise<PickedBlackboxFile | undefined> {
  if ("showOpenFilePicker" in window) {
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
    const file = await fileHandle.getFile();
    return { name: fileHandle.name, text: await file.text() };
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, text: await file.text() } : undefined);
    };
    input.click();
  });
}

export const useBlackboxStore = defineStore("blackbox", {
  state: () => ({
    rate: 0,
    looptime: 0,
    duration: 0,
    filename: "",
    loadState: BlackboxLoadState.EMPTY,
    loadError: "",
    start: 0,
    end: -1,
    fields: {} as { [index: string]: BlackboxFieldDef },
    entries: {} as { [index: string]: Float32Array },
  }),
  getters: {
    entriesPerMS(state) {
      if (!state.looptime || !state.rate) {
        return 0;
      }
      return 1000 / state.looptime / state.rate;
    },
    isLoaded(state) {
      return state.loadState == BlackboxLoadState.LOADED;
    },
    sampleFrequency(state) {
      if (!state.looptime || !state.rate) {
        return 0;
      }
      return 1000000 / (state.rate * state.looptime);
    },
    entryCount(state) {
      return state.entries.time?.length || 0;
    },
    isRoverLog(state) {
      const mode = state.entries.debug_0;
      if (!mode?.length) {
        return false;
      }

      const step = Math.max(Math.floor(mode.length / 100), 1);
      let valid = 0;
      let checked = 0;
      for (let i = 0; i < mode.length; i += step) {
        checked++;
        if (mode[i] >= 0 && mode[i] <= 2) {
          valid++;
        }
      }
      return checked > 0 && valid / checked > 0.9;
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

        const axisNames =
          field.name == "debug" && this.isRoverLog
            ? ROVER_DEBUG_FIELDS
            : field.axis;
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
              title: field.title + " " + (axisNames?.[index] || name),
              index,
            };
          }),
        ];
        options.push(opt);
      };

      for (const field of fields) {
        generateOption(field);
      }
      if (
        ["pid_pterm", "pid_iterm", "pid_dterm"].every(
          (name) => this.fields[name]
        )
      ) {
        generateOption({
          name: "pid_sum",
          scale: this.fields.pid_pterm.scale || 1,
          title: "Pid Sum",
          unit: BlackboxFieldUnit.NONE,
          axis: ["Roll", "Pitch", "Yaw"],
        });
      }

      if (this.fields.setpoint && this.fields.gyro_filter) {
        generateOption({
          name: "setpoint_error",
          scale: this.fields.setpoint.scale || 1,
          title: "Setpoint Error",
          unit: BlackboxFieldUnit.RADIANS,
          axis: ["Roll", "Pitch", "Yaw"],
        });
      }

      if (this.isRoverLog) {
        const debugScale = this.fields.debug?.scale || 1;
        for (const [index, title] of ROVER_DEBUG_FIELDS.entries()) {
          if (!this.entries[`rover_debug_${index}`]) {
            continue;
          }
          generateOption({
            name: `rover_debug_${index}`,
            scale: debugScale,
            title,
            unit: BlackboxFieldUnit.NONE,
          });
        }
      }

      return options;
    },
  },
  actions: {
    async loadBlackbox() {
      this.loadError = "";
      let pickedFile: PickedBlackboxFile | undefined;
      try {
        pickedFile = await pickBlackboxFile();
      } catch (err: any) {
        if (err?.name != "AbortError") {
          this.loadError = err instanceof Error ? err.message : String(err);
          this.loadState = BlackboxLoadState.ERROR;
        }
        return;
      }

      if (!pickedFile) {
        return;
      }

      await this.loadPickedBlackbox(pickedFile);
    },
    async loadBlackboxFile(file: File) {
      await this.loadPickedBlackbox({
        name: file.name,
        text: await file.text(),
      });
    },
    async loadPickedBlackbox(pickedFile: PickedBlackboxFile) {
      this.loadError = "";
      this.loadState = BlackboxLoadState.LOADING;
      this.clearLoadedData();

      let blackbox: any;
      try {
        blackbox = JSON.parse(pickedFile.text);
        validateBlackboxFile(blackbox);
      } catch (err) {
        this.loadError = err instanceof Error ? err.message : String(err);
        this.loadState = BlackboxLoadState.ERROR;
        return;
      }

      this.filename = pickedFile.name;
      this.rate = blackbox.blackbox_rate;
      this.looptime = blackbox.looptime;
      this.start = 0;
      this.end = -1;
      const blackboxFields = blackbox.fields as BlackboxFieldDef[];
      this.fields = blackboxFields.reduce(
        (prev: any, curr: BlackboxFieldDef) => {
          prev[curr.name] = curr;
          return prev;
        },
        {}
      );

      const entries = {} as { [index: string]: Float32Array };
      const rawEntries = processEntries(blackbox.entries, blackboxFields);
      if (!rawEntries.length) {
        this.loadError = "Blackbox file does not contain any valid log entries";
        this.loadState = BlackboxLoadState.ERROR;
        return;
      }

      for (const [fieldIndex, field] of blackboxFields.entries()) {
        let fields = [{ name: field.name } as BlackboxFieldID];
        if (field.axis) {
          fields = field.axis.map((_, index) => {
            return { name: field.name, index } as BlackboxFieldID;
          });
        }
        for (const id of fields) {
          const values = new Float32Array(rawEntries.length);
          for (const [entryIndex, entry] of rawEntries.entries()) {
            let val = entry[fieldIndex];
            if (id.index != undefined) {
              val = Array.isArray(val)
                ? val[id.index]
                : id.index == 0
                ? val
                : 0;
            }
            values[entryIndex] = Number.isFinite(val) ? val : 0;
          }

          entries[blackboxFieldIDToString(id)] = values;
        }
      }
      for (let axis = 0; axis < 3; axis++) {
        const pterm = entries[`pid_pterm_${axis}`];
        const iterm = entries[`pid_iterm_${axis}`];
        const dterm = entries[`pid_dterm_${axis}`];
        if (pterm && iterm && dterm) {
          entries[`pid_sum_${axis}`] = Float32Array.from(pterm, (_, index) => {
            return pterm[index] + iterm[index] + dterm[index];
          });
        }

        const setpoint = entries[`setpoint_${axis}`];
        const gyroFilter = entries[`gyro_filter_${axis}`];
        if (setpoint && gyroFilter) {
          entries[`setpoint_error_${axis}`] = Float32Array.from(
            setpoint,
            (_, index) => {
              return setpoint[index] - gyroFilter[index];
            }
          );
        }
      }

      for (let index = 0; index < ROVER_DEBUG_FIELDS.length; index++) {
        const debug = entries[`debug_${index}`];
        if (debug) {
          entries[`rover_debug_${index}`] = debug;
        }
      }

      this.entries = entries;
      this.loadState = BlackboxLoadState.LOADED;
      this.refreshAfterEntriesChanged();
    },
    cutEntries(start = 0, end = -1) {
      if (!this.entries.time?.length) {
        return;
      }

      const length = this.entries.time.length;
      const safeStart = Math.min(Math.max(Math.floor(start), 0), length);
      const safeEnd =
        end < 0
          ? length
          : Math.min(Math.max(Math.floor(end), safeStart), length);
      for (const key of Object.keys(this.entries)) {
        this.entries[key] = this.entries[key].slice(safeStart, safeEnd);
      }

      this.start = 0;
      this.end = -1;
      this.refreshAfterEntriesChanged();
    },
    refreshAfterEntriesChanged() {
      const time = this.entries.time;
      this.duration = time?.length
        ? (time[time.length - 1] - time[0]) / 1000
        : 0;

      const timeline = useTimelineStore();
      timeline.initTimeline(time?.length || 0, this.duration, this.isRoverLog);

      const spectrum = useSpectrumStore();
      spectrum.initSpectrum(this.isRoverLog);
    },
    clearLoadedData() {
      this.rate = 0;
      this.looptime = 0;
      this.duration = 0;
      this.filename = "";
      this.start = 0;
      this.end = -1;
      this.fields = {};
      this.entries = {};

      useTimelineStore().$reset();
      useSpectrumStore().$reset();
    },
  },
});
