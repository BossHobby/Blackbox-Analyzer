import { defineStore } from "pinia";
import { useTimelineStore } from "./timeline";

export enum BlackboxFields {
  LOOP,
  TIME,
  PID_P_TERM,
  PID_I_TERM,
  PID_D_TERM,
  RX,
  SETPOINT,
  ACCEL_RAW,
  ACCEL_FILTER,
  GYRO_RAW,
  GYRO_FILTER,
  MOTOR,
  CPU_LOAD,
}

export function transformGyro(val: number) {
  return (val / 1000) * (180 / Math.PI);
}

export const useBlackboxStore = defineStore("blackbox", {
  state: () => ({
    rate: 0,
    looptime: 0,
    duration: 0,
    entries: [],
  }),
  getters: {
    entriesPerMS(state) {
      return 1000 / state.looptime / state.rate;
    },
  },
  actions: {
    async loadBlackbox() {
      const timeline = useTimelineStore();

      const pickerOpts = {
        types: [
          {
            description: "Logs",
            accept: {
              "image/*": [".json"],
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
      this.entries = blackbox.entries;
      this.duration =
        (blackbox.entries[blackbox.entries.length - 1][BlackboxFields.TIME] -
          blackbox.entries[0][BlackboxFields.TIME]) /
        1000;
      timeline.initTimeline(this.entries.length, this.duration);
    },
  },
});
