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
        fields: [field("rover_debug_6")],
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

function sanitizeSpectrumGraphs(graphs: SpectrumGraph[], isRover: boolean) {
  const bb = useBlackboxStore();
  const validFields = new Set(
    bb.fieldOptions
      .flat()
      .filter((option: any) => !option.group)
      .map((option: any) => blackboxFieldIDToString(option.id))
  );

  const sanitized = graphs
    .map((graph) => {
      return {
        ...graph,
        fields: graph.fields.filter((graphField) =>
          validFields.has(blackboxFieldIDToString(graphField.id))
        ),
      };
    })
    .filter((graph) => graph.fields.length);

  return sanitized.length ? sanitized : defaultSpectrumGraphs(isRover);
}

function defaultHeatmapField(graphs: SpectrumGraph[]): BlackboxFieldID {
  const bb = useBlackboxStore();
  if (bb.entries.gyro_raw_0) {
    return { name: "gyro_raw", index: 0 };
  }
  if (bb.entries.gyro_filter_0) {
    return { name: "gyro_filter", index: 0 };
  }
  return graphs[0]?.fields[0]?.id || { name: "time" };
}

export const useSpectrumStore = defineStore("spectrum", {
  state: () => ({
    hoverPos: 0,
    displayRangeX: 1,
    displayRangeY: 1,
    heatmapField: undefined as BlackboxFieldID | undefined,
    heatmapMaxFrequency: 300,
    heatmapBinCount: 20,

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
    graphFields(state): any[][] {
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
    heatmapFieldOption(state): any | undefined {
      const bb = useBlackboxStore();
      const options = bb.fieldOptions.flat().filter((option: any) => !option.group);
      const id = state.heatmapField || defaultHeatmapField(state.graphs);
      return options.find(
        (option: any) =>
          blackboxFieldIDToString(option.id) == blackboxFieldIDToString(id)
      );
    },
  },
  actions: {
    initSpectrum(isRover = false) {
      this.$reset();
      this.ready = true;
      try {
        const str = localStorage.getItem("spectrum-graphs");
        if (str) {
          this.graphs = sanitizeSpectrumGraphs(JSON.parse(str), isRover);
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
    removeGraph(graphIndex: number) {
      this.graphs.splice(graphIndex, 1);
      this.fieldTemplate.splice(graphIndex, 1);
    },
    applyDefaultGraphs(isRover = false) {
      this.graphs = defaultSpectrumGraphs(isRover);
      this.fieldTemplate = [];
    },
    setHeatmapMaxFrequency(value: number) {
      this.heatmapMaxFrequency = Math.min(Math.max(Math.round(value), 20), 1000);
    },
    setHeatmapBinCount(value: number) {
      this.heatmapBinCount = Math.min(Math.max(Math.round(value), 5), 50);
    },
  },
});
