import { defineStore } from "pinia";
import {
  blackboxFieldIDToString,
  useBlackboxStore,
  type BlackboxFieldID,
} from "./blackbox";

const ZOOM_MIN = 100;

export const useTimelineStore = defineStore("timeline", {
  state: () => ({
    cursor: 500, // in ms
    hover: 0.5, // in % of zoom/window
    zoom: 1000, // in ms

    fieldTemplate: [] as any[],
    graphs: [
      {
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
    initTimeline(entries: number, duration: number) {
      this.$reset();
      this._entries = entries;
      this._duration = duration;
      this.ready = true;
      try {
        const str = localStorage.getItem("timeline-graphs");
        if (str) {
          this.graphs = JSON.parse(str);
        }
      } catch (e: any) {
        console.warn("error loading graphs from localStorage", e);
      }
    },
    setCursor(pos: number) {
      this.cursor = Math.min(
        Math.max(pos, this.zoom / 2),
        this._duration - this.zoom / 2
      );
    },
    moveCursor(delta: number) {
      this.cursor = Math.min(
        Math.max(this.cursor - delta, this.zoom / 2),
        this._duration - this.zoom / 2
      );
    },
    setZoom(delta: number) {
      this.zoom = Math.min(
        Math.max(Math.round(delta), ZOOM_MIN),
        Math.min(this._duration, 30 * 1000)
      );
    },
    modifyZoom(delta: number) {
      this.zoom = Math.min(
        Math.max(Math.round(this.zoom + this.zoom * delta), ZOOM_MIN),
        Math.min(this._duration, 30 * 1000)
      );
      this.cursor = Math.min(
        Math.max(this.cursor, this.zoom / 2),
        this._duration - this.zoom / 2
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
        fields: [] as any[],
      });
      this.fieldTemplate.push(undefined);
    },
  },
});
