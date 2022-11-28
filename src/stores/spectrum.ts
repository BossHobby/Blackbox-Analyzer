import { defineStore } from "pinia";

export const useSpectrumStore = defineStore("spectrum", {
  state: () => ({
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
