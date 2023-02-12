import { defineStore } from "pinia";

export type DrawFuntion = (time: DOMHighResTimeStamp) => void;

export const useRenderStore = defineStore("render", {
  state: () => ({
    sidebar: false,
    drawFunctionId: 1,
    drawFunctions: {} as { [index: string]: DrawFuntion },
    animationeFrameId: 0,

    colors: ["#FFBE0B", "#FF006E", "#8338Ec", "#3A86FF", "#FB5607"],
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
    },
  },
});
