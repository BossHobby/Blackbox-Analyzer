import { defineStore } from "pinia";
import {
  blackboxFieldIDToString,
  useBlackboxStore,
  type BlackboxFieldID,
} from "./blackbox";

export const useSpectrumStore = defineStore("spectrum", {
  state: () => ({
    hoverPos: 0,
    displayRangeX: 1,
    displayRangeY: 1,

    fieldTemplate: [] as any[],
    graphs: [
      {
        fields: [] as {
          id: BlackboxFieldID;
        }[],
      },
    ],

    expo: 1,

    ready: false,
  }),
  getters: {
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
    initSpectrum() {
      this.$reset();
      this.ready = true;
      try {
        const str = localStorage.getItem("spectrum-graphs");
        if (str) {
          this.graphs = JSON.parse(str);
        }
      } catch (e: any) {
        console.warn("error loading graphs from localStorage", e);
      }
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
          });
        }
      } else {
        this.graphs[graphIndex].fields.push({
          id: { name: tmpl.name } as BlackboxFieldID,
        });
      }

      this.fieldTemplate[graphIndex] = undefined;
    },
    addGraph() {
      this.graphs.push({
        fields: [] as any[],
      });
      this.fieldTemplate.push(null);
    },
  },
});
