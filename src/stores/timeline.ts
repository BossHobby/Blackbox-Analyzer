import { defineStore } from "pinia";
import {
  blackboxFieldIDToString,
  useBlackboxStore,
  type BlackboxFieldID,
} from "./blackbox";

const ZOOM_MIN = 100;
const AXIS_NAMES = ["Roll", "Pitch", "Yaw"];

type TimelineGraphField = {
  id?: BlackboxFieldID;
  expo: number;
};

type TimelineGraph = {
  title: string;
  fields: TimelineGraphField[];
};

function field(name: string, index?: number, expo = 100): TimelineGraphField {
  return {
    id: index == undefined ? { name } : { name, index },
    expo,
  };
}

function fieldAvailable(graphField: TimelineGraphField) {
  const bb = useBlackboxStore();
  return !!bb.entries[blackboxFieldIDToString(graphField.id)];
}

function graph(title: string, fields: TimelineGraphField[]) {
  const validFields = fields.filter(fieldAvailable);
  return validFields.length ? { title, fields: validFields } : undefined;
}

function outputFields(count = 4) {
  return Array.from({ length: count }, (_, index) => field("output", index));
}

function defaultTimelineGraphs(isRover: boolean): TimelineGraph[] {
  if (isRover) {
    return [
      graph("Rover Steering", [
        field("setpoint", 2),
        field("gyro_filter", 2),
        field("setpoint_error", 2),
      ]),
      graph("Steering PID", [
        field("pid_pterm", 2),
        field("pid_iterm", 2),
        field("pid_dterm", 2),
        field("pid_sum", 2),
      ]),
      graph("Rover Assist", [
        field("rover_debug_2"),
        field("rover_debug_3"),
        field("rover_debug_5"),
        field("rover_debug_6"),
      ]),
      graph("Inputs", [field("rx", 2), field("rx", 3)]),
      graph("Outputs", outputFields()),
    ].filter((item): item is TimelineGraph => item != undefined);
  }

  const bb = useBlackboxStore();
  return [
    ...AXIS_NAMES.map((axisName, axis) =>
      graph(`${axisName} Tracking`, [
        field("setpoint", axis),
        field("gyro_filter", axis),
        field("setpoint_error", axis),
        field("pid_sum", axis),
      ]),
    ),
    ...AXIS_NAMES.map((axisName, axis) =>
      graph(`${axisName} PID`, [
        field("gyro_filter", axis),
        field("pid_pterm", axis),
        field("pid_iterm", axis),
        field("pid_dterm", axis),
      ]),
    ),
    bb.isDynamicNotchLog
      ? graph(
          "Dynamic Notch",
          Array.from({ length: 9 }, (_, index) => field("debug", index)),
        )
      : undefined,
    graph("Outputs", outputFields()),
  ].filter((item): item is TimelineGraph => item != undefined);
}

function sanitizeTimelineGraphs(graphs: TimelineGraph[], isRover: boolean) {
  const bb = useBlackboxStore();
  const validFields = new Set(
    bb.fieldOptions
      .flat()
      .filter((option: any) => !option.group)
      .map((option: any) => blackboxFieldIDToString(option.id)),
  );

  const sanitized = graphs
    .map((graph) => {
      return {
        ...graph,
        fields: graph.fields.filter((graphField) =>
          validFields.has(blackboxFieldIDToString(graphField.id)),
        ),
      };
    })
    .filter((graph) => graph.fields.length);

  return sanitized.length ? sanitized : defaultTimelineGraphs(isRover);
}

export const useTimelineStore = defineStore("timeline", {
  state: () => ({
    cursor: 500, // in ms
    hover: 0.5, // in % of zoom/window
    zoom: 1000, // in ms

    graphs: [
      {
        title: "",
        fields: [] as {
          id?: BlackboxFieldID;
          expo: number;
        }[],
      },
    ],

    ready: false,
    _entries: 0,
    _duration: 0, // in ms
  }),
  getters: {
    pixelsPerMS(state) {
      return (width: number) => {
        return width / state._duration;
      };
    },
    cursorWidth(state) {
      return (width: number) => {
        return state.zoom * this.pixelsPerMS(width);
      };
    },
    cursorPos(state) {
      return (width: number) => {
        return state.cursor * this.pixelsPerMS(width);
      };
    },
    windowSize(): number {
      const bb = useBlackboxStore();
      return Math.max(Math.floor(this.zoom * bb.entriesPerMS), 0);
    },
    windowOffset(): number {
      const bb = useBlackboxStore();
      return Math.floor(this.cursor * bb.entriesPerMS - this.windowSize / 2);
    },
    windowHoverIndex(): number {
      return this.windowOffset + this.hover * this.windowSize;
    },
    windowPixelsPerMS(state) {
      return (width: number) => {
        return width / state.zoom;
      };
    },
    windowHoverPos(state) {
      return (width: number) => {
        return state.hover * state.zoom * this.windowPixelsPerMS(width);
      };
    },
    graphFields(state) {
      const bb = useBlackboxStore();
      const options = bb.fieldOptions.flat();
      return state.graphs.map((g) => {
        return g.fields
          .map((f) => {
            const option = options.find(
              (o) =>
                blackboxFieldIDToString(o.id) == blackboxFieldIDToString(f.id),
            );
            return option && bb.entries[blackboxFieldIDToString(option.id)]
              ? {
                  ...f,
                  ...option,
                }
              : undefined;
          })
          .filter((field) => field != undefined);
      });
    },
  },
  actions: {
    initTimeline(entries: number, duration: number, isRover = false) {
      this.$reset();
      this._entries = entries;
      this._duration = duration;
      this.ready = true;
      try {
        const str = localStorage.getItem("timeline-graphs");
        if (str) {
          this.graphs = sanitizeTimelineGraphs(JSON.parse(str), isRover);
        } else {
          this.graphs = defaultTimelineGraphs(isRover);
        }
      } catch (e: any) {
        console.warn("error loading graphs from localStorage", e);
        this.graphs = defaultTimelineGraphs(isRover);
      }

      if (
        !this.graphs.length ||
        this.graphs.every((graph) => !graph.fields.length)
      ) {
        this.graphs = defaultTimelineGraphs(isRover);
      }
    },
    setCursor(pos: number) {
      if (this._duration <= 0) {
        this.cursor = 0;
        return;
      }
      this.cursor = Math.min(
        Math.max(pos, this.zoom / 2),
        Math.max(this._duration - this.zoom / 2, this.zoom / 2),
      );
    },
    moveCursor(delta: number) {
      if (this._duration <= 0) {
        this.cursor = 0;
        return;
      }
      this.cursor = Math.min(
        Math.max(this.cursor - delta, this.zoom / 2),
        Math.max(this._duration - this.zoom / 2, this.zoom / 2),
      );
    },
    setZoom(delta: number) {
      this.zoom = Math.min(
        Math.max(Math.round(delta), ZOOM_MIN),
        Math.max(Math.min(this._duration, 30 * 1000), ZOOM_MIN),
      );
    },
    modifyZoom(delta: number) {
      this.zoom = Math.min(
        Math.max(Math.round(this.zoom + this.zoom * delta), ZOOM_MIN),
        Math.max(Math.min(this._duration, 30 * 1000), ZOOM_MIN),
      );
      this.cursor = Math.min(
        Math.max(this.cursor, this.zoom / 2),
        Math.max(this._duration - this.zoom / 2, this.zoom / 2),
      );
    },
    // Centers the window on a frame range with some context on either side.
    focusRange(startIndex: number, endIndex: number) {
      const bb = useBlackboxStore();
      if (!bb.entriesPerMS) {
        return;
      }
      const startMs = startIndex / bb.entriesPerMS;
      const endMs = endIndex / bb.entriesPerMS;
      this.setZoom(Math.max((endMs - startMs) * 3, 1000));
      this.setCursor((startMs + endMs) / 2);
      this.hover = 0.5;
    },
    setWindowHover(width: number, offset: number) {
      const pos = offset / width;
      this.hover = Math.min(Math.max(pos, 0), 1);
    },

    addField(graphIndex: number) {
      this.graphs[graphIndex].fields.push({
        id: undefined,
        expo: 100,
      });
    },
    addGraph() {
      this.graphs.push({
        title: "",
        fields: [] as any[],
      });
    },
    removeGraph(graphIndex: number) {
      this.graphs.splice(graphIndex, 1);
    },
    applyDefaultGraphs(isRover = false) {
      this.graphs = defaultTimelineGraphs(isRover);
    },
  },
});
