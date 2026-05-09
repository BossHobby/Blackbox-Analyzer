import { defineStore } from "pinia";
import {
  blackboxFieldIDToString,
  useBlackboxStore,
  type BlackboxFieldID,
} from "./blackbox";

const ZOOM_MIN = 100;

type TimelineGraphField = {
  id: BlackboxFieldID;
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

function defaultTimelineGraphs(isRover: boolean): TimelineGraph[] {
  if (isRover) {
    return [
      {
        title: "Rover Steering",
        fields: [
          field("setpoint", 2),
          field("gyro_filter", 2),
          field("setpoint_error", 2),
        ],
      },
      {
        title: "Steering PID",
        fields: [
          field("pid_pterm", 2),
          field("pid_iterm", 2),
          field("pid_dterm", 2),
          field("pid_sum", 2),
        ],
      },
      {
        title: "Rover Assist",
        fields: [
          field("rover_debug_2"),
          field("rover_debug_3"),
          field("rover_debug_6"),
        ],
      },
      {
        title: "Inputs",
        fields: [field("rx", 2), field("rx", 3)],
      },
    ];
  }

  return [
    {
      title: "Gyro Tracking",
      fields: [
        field("setpoint", 0),
        field("gyro_filter", 0),
        field("setpoint", 1),
        field("gyro_filter", 1),
      ],
    },
    {
      title: "PID Sum",
      fields: [field("pid_sum", 0), field("pid_sum", 1), field("pid_sum", 2)],
    },
    {
      title: "Motors",
      fields: [
        field("motor", 0),
        field("motor", 1),
        field("motor", 2),
        field("motor", 3),
      ],
    },
  ];
}

function sanitizeTimelineGraphs(graphs: TimelineGraph[], isRover: boolean) {
  const bb = useBlackboxStore();
  const validFields = new Set(
    bb.fieldOptions
      .flat()
      .filter((option: any) => !option.group)
      .map((option: any) => blackboxFieldIDToString(option.id))
  );

  const sanitized = graphs
    .map((graph) => {
      return {
        ...graph,
        fields: graph.fields.filter((graphField) =>
          validFields.has(blackboxFieldIDToString(graphField.id))
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

    fieldTemplate: [] as any[],
    graphs: [
      {
        title: "",
        fields: [] as {
          id: BlackboxFieldID;
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
        return g.fields.map((f) => {
          return {
            ...f,
            ...options.find(
              (o) =>
                blackboxFieldIDToString(o.id) == blackboxFieldIDToString(f.id)
            ),
          };
        });
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
        Math.max(this._duration - this.zoom / 2, this.zoom / 2)
      );
    },
    moveCursor(delta: number) {
      if (this._duration <= 0) {
        this.cursor = 0;
        return;
      }
      this.cursor = Math.min(
        Math.max(this.cursor - delta, this.zoom / 2),
        Math.max(this._duration - this.zoom / 2, this.zoom / 2)
      );
    },
    setZoom(delta: number) {
      this.zoom = Math.min(
        Math.max(Math.round(delta), ZOOM_MIN),
        Math.max(Math.min(this._duration, 30 * 1000), ZOOM_MIN)
      );
    },
    modifyZoom(delta: number) {
      this.zoom = Math.min(
        Math.max(Math.round(this.zoom + this.zoom * delta), ZOOM_MIN),
        Math.max(Math.min(this._duration, 30 * 1000), ZOOM_MIN)
      );
      this.cursor = Math.min(
        Math.max(this.cursor, this.zoom / 2),
        Math.max(this._duration - this.zoom / 2, this.zoom / 2)
      );
    },
    setWindowHover(width: number, offset: number) {
      const pos = offset / width;
      this.hover = Math.min(Math.max(pos, 0), 1);
    },

    addField(graphIndex: number) {
      const tmpl = this.fieldTemplate[graphIndex] as any;
      if (!tmpl) {
        return;
      }

      if (tmpl.group) {
        for (let i = 0; i < tmpl.group; i++) {
          this.graphs[graphIndex].fields.push({
            id: { name: tmpl.name, index: i } as BlackboxFieldID,
            expo: 100,
          });
        }
      } else {
        this.graphs[graphIndex].fields.push({
          id: { name: tmpl.name } as BlackboxFieldID,
          expo: 100,
        });
      }

      this.fieldTemplate[graphIndex] = undefined;
    },
    addGraph() {
      this.graphs.push({
        title: "",
        fields: [] as any[],
      });
      this.fieldTemplate.push(undefined);
    },
    removeGraph(graphIndex: number) {
      this.graphs.splice(graphIndex, 1);
      this.fieldTemplate.splice(graphIndex, 1);
    },
    applyDefaultGraphs(isRover = false) {
      this.graphs = defaultTimelineGraphs(isRover);
      this.fieldTemplate = [];
    },
  },
});
