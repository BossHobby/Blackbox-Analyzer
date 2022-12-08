import { defineStore } from "pinia";

const ZOOM_MIN = 100;

export const useTimelineStore = defineStore("timeline", {
  state: () => ({
    cursor: 500, // in ms
    hover: 0.5, // in % of zoom/window
    zoom: 1000, // in ms

    fieldTemplate: [null],
    graphs: [
      {
        fields: [] as any[],
      },
    ],

    expo: 1,

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
        this._duration * 0.1
      );
    },
    modifyZoom(delta: number) {
      this.zoom = Math.min(
        Math.max(Math.round(this.zoom + this.zoom * delta), ZOOM_MIN),
        this._duration * 0.1
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
          const entry = {
            ...tmpl,
            title: tmpl.groupTitle + " " + tmpl.axis[i],
            index: i,
          };
          delete entry.groupTitle;
          delete entry.group;
          this.graphs[graphIndex].fields.push(entry);
        }
      } else {
        this.graphs[graphIndex].fields.push(tmpl);
      }

      this.fieldTemplate[graphIndex] = null;
    },
    addGraph() {
      this.graphs.push({
        fields: [] as any[],
      });
      this.fieldTemplate.push(null);
    },
  },
});
