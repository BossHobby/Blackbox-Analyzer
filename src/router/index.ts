import { createRouter, createWebHistory } from "vue-router";

import OverviewView from "../views/OverviewView.vue";
import TuneView from "../views/TuneView.vue";
import TimelineView from "../views/TimelineView.vue";
import SpectrumView from "../views/SpectrumView.vue";

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
    description?: string;
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "overview",
      component: OverviewView,
      meta: {
        title: "Overview",
        description: "What happened in this flight and where to look.",
      },
    },
    {
      path: "/tune",
      name: "tune",
      component: TuneView,
      meta: {
        title: "Tune",
        description: "Step response and noise spectrogram.",
      },
    },
    {
      path: "/timeline",
      name: "timeline",
      component: TimelineView,
      meta: {
        title: "Timeline",
        description: "Step through the flight and compare fields over time.",
      },
    },
    {
      path: "/spectrum",
      name: "spectrum",
      component: SpectrumView,
      meta: {
        title: "Spectrum",
        description: "Frequency content of the selected range.",
      },
    },
  ],
});

export default router;
