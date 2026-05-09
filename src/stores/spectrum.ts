import { defineStore } from "pinia";
import {
  blackboxFieldIDToString,
  useBlackboxStore,
  type BlackboxFieldID,
} from "./blackbox";

type SpectrumGraphField = {
  id: BlackboxFieldID;
};

type SpectrumGraph = {
  title: string;
  fields: SpectrumGraphField[];
};

function field(name: string, index?: number): SpectrumGraphField {
  return {
    id: index == undefined ? { name } : { name, index },
  };
}

function defaultSpectrumGraphs(isRover: boolean): SpectrumGraph[] {
  if (isRover) {
    return [
      {
        title: "Yaw Tracking Noise",
        fields: [field("gyro_filter", 2), field("setpoint_error", 2)],
      },
      {
        title: "Throttle Assist",
        fields: [field("rover_debug_1"), field("rover_debug_2")],
      },
    ];
  }

  return [
    {
      title: "Gyro Raw",
      fields: [
        field("gyro_raw", 0),
        field("gyro_raw", 1),
        field("gyro_raw", 2),
      ],
    },
    {
      title: "Gyro Filtered",
      fields: [
        field("gyro_filter", 0),
        field("gyro_filter", 1),
        field("gyro_filter", 2),
      ],
    },
  ];
}

export const useSpectrumStore = defineStore("spectrum", {
  state: () => ({
    hoverPos: 0,
    displayRangeX: 1,
    displayRangeY: 1,

    fieldTemplate: [] as any[],
    graphs: [
      {
        title: "",
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
    initSpectrum(isRover = false) {
      this.$reset();
      this.ready = true;
      try {
        const str = localStorage.getItem("spectrum-graphs");
        if (str) {
          this.graphs = JSON.parse(str);
        } else {
          this.graphs = defaultSpectrumGraphs(isRover);
        }
      } catch (e: any) {
        console.warn("error loading graphs from localStorage", e);
        this.graphs = defaultSpectrumGraphs(isRover);
      }

      if (
        !this.graphs.length ||
        this.graphs.every((graph) => !graph.fields.length)
      ) {
        this.graphs = defaultSpectrumGraphs(isRover);
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
        title: "",
        fields: [] as any[],
      });
      this.fieldTemplate.push(null);
    },
    applyDefaultGraphs(isRover = false) {
      this.graphs = defaultSpectrumGraphs(isRover);
      this.fieldTemplate = [];
    },
  },
});
