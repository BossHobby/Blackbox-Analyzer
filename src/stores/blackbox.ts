import { defineStore } from "pinia";
import { useSpectrumStore } from "./spectrum";
import { useTimelineStore } from "./timeline";
import { readLastLog, saveLastLog } from "./last-log";
import { loadLog } from "@/log/load";
import {
  ROVER_DEBUG_FIELDS,
  buildProfileSummaryTags,
  cleanString,
  isDynamicNotchProfileLog,
  isRoverDebugProfileLog,
  isRoverProfileLog,
  profileFilterCutoffs,
  profileVehicleLabel,
} from "@/log/profile";
import {
  BlackboxFieldUnit,
  type BlackboxFieldDef,
  type BlackboxFieldID,
  type BlackboxFilterCutoff,
  type LogColumns,
} from "@/log/types";

export * from "@/log/types";

export enum BlackboxLoadState {
  EMPTY = "empty",
  LOADING = "loading",
  LOADED = "loaded",
  ERROR = "error",
}

interface PickedBlackboxFile {
  name: string;
  blob: Blob;
}

async function pickBlackboxFile(): Promise<PickedBlackboxFile | undefined> {
  if ("showOpenFilePicker" in window) {
    const pickerOpts: OpenFilePickerOptions = {
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
    return { name: fileHandle.name, blob: file };
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, blob: file } : undefined);
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
    profile: undefined as any,
    start: 0,
    end: -1,
    fields: {} as { [index: string]: BlackboxFieldDef },
    entries: {} as LogColumns,
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
    activeEnd(state) {
      const length = state.entries.time?.length || 0;
      return state.end > 0 ? Math.min(state.end, length) : length;
    },
    hasSelection(state) {
      const length = state.entries.time?.length || 0;
      const end = state.end > 0 ? Math.min(state.end, length) : length;
      return length > 0 && (state.start > 0 || end < length);
    },
    selectedEntryCount(): number {
      return Math.max(this.activeEnd - this.start, 0);
    },
    selectedDuration(state): number {
      const time = state.entries.time;
      if (!time?.length || this.selectedEntryCount <= 1) {
        return 0;
      }

      const start = Math.min(Math.max(state.start, 0), time.length - 1);
      const end = Math.min(
        Math.max(this.activeEnd - 1, start),
        time.length - 1,
      );
      return (time[end] - time[start]) / 1000;
    },
    selectionStartIndex(state): number {
      const length = state.entries.time?.length || 0;
      return Math.min(Math.max(state.start, 0), length);
    },
    selectionEndIndex(): number {
      return this.activeEnd;
    },
    isRoverLog(state) {
      return isRoverProfileLog(state.profile);
    },
    isDynamicNotchLog(state) {
      return isDynamicNotchProfileLog(state.profile);
    },
    vehicleLabel(state) {
      return profileVehicleLabel(state.profile);
    },
    profileName(state) {
      return cleanString(state.profile?.meta?.name);
    },
    profileSummaryTags(state) {
      return buildProfileSummaryTags(state.profile);
    },
    filterCutoffs(state): BlackboxFilterCutoff[] {
      return profileFilterCutoffs(state.profile);
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
            const axisDef = field.axisDefs?.[index] || {};
            return {
              ...field,
              ...axisDef,
              id: { name: field.name, index } as BlackboxFieldID,
              title: axisDef.title || field.title + " " + name,
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
          (name) => this.fields[name],
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

      if (isRoverDebugProfileLog(this.profile)) {
        for (const [index, def] of ROVER_DEBUG_FIELDS.entries()) {
          if (!this.entries[`rover_debug_${index}`]) {
            continue;
          }
          generateOption({
            ...def,
            name: `rover_debug_${index}`,
            scale: def.scale || 1,
            title: def.title || `Debug ${index}`,
            unit: def.unit || BlackboxFieldUnit.NONE,
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
      await this.loadPickedBlackbox({ name: file.name, blob: file });
    },
    async loadPickedBlackbox(pickedFile: PickedBlackboxFile) {
      this.loadError = "";
      this.loadState = BlackboxLoadState.LOADING;
      this.clearLoadedData();

      let log;
      try {
        log = await loadLog(pickedFile.blob);
      } catch (err) {
        this.loadError = err instanceof Error ? err.message : String(err);
        this.loadState = BlackboxLoadState.ERROR;
        return;
      }

      this.filename = pickedFile.name;
      this.profile = log.profile;
      this.rate = log.rate;
      this.looptime = log.looptime;
      this.start = 0;
      this.end = -1;
      this.fields = Object.fromEntries(
        log.fields.map((field) => [field.name, field]),
      );
      this.entries = log.entries;
      this.loadState = BlackboxLoadState.LOADED;
      this.refreshAfterEntriesChanged();

      if (import.meta.env.DEV) {
        saveLastLog(pickedFile);
      }
    },
    async restoreLastBlackbox() {
      const log = await readLastLog();
      if (log && this.loadState == BlackboxLoadState.EMPTY) {
        await this.loadPickedBlackbox(log);
      }
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
      this.profile = undefined;
      this.start = 0;
      this.end = -1;
      this.fields = {};
      this.entries = {};

      useTimelineStore().$reset();
      useSpectrumStore().$reset();
    },
  },
});
