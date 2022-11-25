import { defineStore } from "pinia";

export const useBlackboxStore = defineStore("blackbox", {
  state: () => ({
    entries: [],
  }),
  actions: {
    fetchBlackbox() {
      return fetch("/assets/blackbox.json")
        .then((res) => res.json())
        .then((data) => (this.entries = data));
    },
  },
});
