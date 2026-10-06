import { defineStore } from "pinia";
import {
  blackboxFieldIDToString,
  useBlackboxStore,
  type BlackboxFieldID,
} from "./blackbox";

type SpectrumGraphField = {
  id?: BlackboxFieldID;
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

function fieldAvailable(graphField: SpectrumGraphField) {
  const bb = useBlackboxStore();
  return !!bb.entries[blackboxFieldIDToString(graphField.id)];
}

function graph(title: string, fields: SpectrumGraphField[]) {
  const validFields = fields.filter(fieldAvailable);
  return validFields.length ? { title, fields: validFields } : undefined;
}

function defaultSpectrumGraphs(isRover: boolean): SpectrumGraph[] {
  if (isRover) {
    return [
      graph("Steering Tracking", [
        field("gyro_filter", 2),
        field("setpoint_error", 2),
      ]),
      graph("Steering DTerm", [field("pid_dterm", 2)]),
      graph("Throttle Assist", [field("rover_debug_5")]),
    ].filter((item): item is SpectrumGraph => item != undefined);
  }

  return [
    graph("Gyro Raw", [
      field("gyro_raw", 0),
      field("gyro_raw", 1),
      field("gyro_raw", 2),
    ]),
    graph("Gyro Filtered", [
      field("gyro_filter", 0),
      field("gyro_filter", 1),
      field("gyro_filter", 2),
    ]),
    graph("Setpoint Error", [
      field("setpoint_error", 0),
      field("setpoint_error", 1),
      field("setpoint_error", 2),
    ]),
    graph("DTerm", [
      field("pid_dterm", 0),
      field("pid_dterm", 1),
      field("pid_dterm", 2),
    ]),
  ].filter((item): item is SpectrumGraph => item != undefined);
}

function sanitizeSpectrumGraphs(graphs: SpectrumGraph[], isRover: boolean) {
  const bb = useBlackboxStore();
  const validFields = new Set(
    bb.fieldOptions
      .flat()
      .filter((option: any) => !option.group)
      .map((option: any) => blackboxFieldIDToString(option.id)),
  );

  const sanitized = graphs
    .map((graph) => {
      return {
        ...graph,
        fields: graph.fields.filter((graphField) =>
          validFields.has(blackboxFieldIDToString(graphField.id)),
        ),
      };
    })
    .filter((graph) => graph.fields.length);

  return sanitized.length ? sanitized : defaultSpectrumGraphs(isRover);
}

export const useSpectrumStore = defineStore("spectrum", {
  state: () => ({
    hoverPos: 0,
    displayRangeX: 1,
    displayRangeY: 1,

    graphs: [
      {
        title: "",
        fields: [] as {
          id?: BlackboxFieldID;
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
        return g.fields
          .map((f) => {
            const option = options.find(
              (o) =>
                blackboxFieldIDToString(o.id) == blackboxFieldIDToString(f.id),
            );
            return option && bb.entries[blackboxFieldIDToString(option.id)]
              ? {
                  ...f,
                  ...option,
                }
              : undefined;
          })
          .filter((field) => field != undefined);
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
      this.graphs[graphIndex].fields.push({
        id: undefined,
      });
    },
    addGraph() {
      this.graphs.push({
        title: "",
        fields: [] as any[],
      });
    },
    removeGraph(graphIndex: number) {
      this.graphs.splice(graphIndex, 1);
    },
    applyDefaultGraphs(isRover = false) {
      this.graphs = defaultSpectrumGraphs(isRover);
    },
  },
});
