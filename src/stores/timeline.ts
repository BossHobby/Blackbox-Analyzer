import { defineStore } from "pinia";

export const useTimelineStore = defineStore("timeline", {
  state: () => ({
    cursor: 500, // in ms
    hover: 0.5, // in % of zoom/window
    zoom: 1000, // in ms
    colors: ["#FFBE0B", "#FF006E", "#8338Ec", "#3A86FF", "#FB5607"],

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
    },
    setCursor(width: number, offset: number) {
      const pos = offset / this.pixelsPerMS(width);
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
    modifyZoom(delta: number) {
      this.zoom = Math.min(
        Math.max(Math.round(this.zoom + this.zoom * delta), 4),
        this._duration
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
  },
});
