import { defineStore } from "pinia";

function readSidebar() {
  try {
    return localStorage.getItem("graph-settings") === "true";
  } catch {
    return false;
  }
}

export type DrawFuntion = (time: DOMHighResTimeStamp) => void;

export const useRenderStore = defineStore("render", {
  state: () => ({
    sidebar: readSidebar(),
    drawFunctionId: 1,
    drawFunctions: {} as { [index: string]: DrawFuntion },
    animationeFrameId: 0,
  }),

  actions: {
    startRender() {
      this.stopRender();
      const doRender = (time: DOMHighResTimeStamp) => {
        for (const fn of Object.values(this.drawFunctions)) {
          fn(time);
        }
        requestAnimationFrame(doRender);
      };
      this.animationeFrameId = requestAnimationFrame(doRender);
    },
    stopRender() {
      if (this.animationeFrameId) {
        cancelAnimationFrame(this.animationeFrameId);
      }
    },
    subscribeDraw(fn: DrawFuntion) {
      const id = this.drawFunctionId++;
      this.drawFunctions[id.toString()] = fn;
      return id;
    },
    unsubscribeDraw(id: number) {
      delete this.drawFunctions[id.toString()];
    },
    toggleSidebar() {
      this.sidebar = !this.sidebar;
      try {
        localStorage.setItem("graph-settings", String(this.sidebar));
      } catch {
        /* Settings still toggle without persistence. */
      }
    },
  },
});
