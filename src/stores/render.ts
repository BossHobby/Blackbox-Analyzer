import { defineStore } from "pinia";

export enum Color {
  GREEN = "hsl(96deg 53% 43%)",
  GREEN_LIGHT = "hsl(96deg 53% 48%)",
  GREEN_DARK = "hsl(96deg 53% 40%)",
  GRAY = "hsl(0, 0%, 19%)",
  GRAY_LIGTH = "hsl(0, 0%, 29%)",
  GRAY_LIGTHER = "hsl(0, 0%, 73%)",
  GRAY_DARKER = "hsl(0, 0%, 16%)",
  GRAY_DARKEST = "hsl(0, 0%, 3%)",
  WHITE = "rgb(255, 255, 255)",
  WHITE_OFF = "rgb(233, 235, 252)",
}

export type DrawFuntion = (time: DOMHighResTimeStamp) => void;

export const useRenderStore = defineStore("render", {
  state: () => ({
    drawFunctionId: 1,
    drawFunctions: {} as { [index: string]: DrawFuntion },
    animationeFrameId: 0,
  }),

  actions: {
    startRender() {
      this.stopRender();
      const doRender = (time: DOMHighResTimeStamp) => {
        for (const key of Object.keys(this.drawFunctions)) {
          this.drawFunctions[key](time);
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
  },
});
