import { createRouter, createWebHistory } from "vue-router";

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
