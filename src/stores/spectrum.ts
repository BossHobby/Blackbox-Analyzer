import { defineStore } from "pinia";

export const useSpectrumStore = defineStore("spectrum", {
  state: () => ({
    hoverPos: 0,
    displayRangeX: 1,
    displayRangeY: 1,

    fieldTemplate: [null],
    graphs: [
      {
        fields: [] as any[],
      },
    ],

    expo: 1,

    ready: false,
  }),
  getters: {},
  actions: {
    initSpectrum() {
      this.$reset();
      this.ready = true;
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
