import { defineStore } from "pinia";

export const useSpectrumStore = defineStore("spectrum", {
  state: () => ({
    hoverPos: 0,
    displayRangeX: 1,
    displayRangeY: 1,

    smoothing: 10,
    expo: 1,

    ready: false,
  }),
  getters: {},
  actions: {
    initSpectrum() {
      this.$reset();
      this.ready = true;
    },
  },
});
