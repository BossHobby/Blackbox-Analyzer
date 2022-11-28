import { createRouter, createWebHistory } from "vue-router";

import TimelineView from "../views/TimelineView.vue";
import SpectrumView from "../views/SpectrumView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "timeline",
      component: TimelineView,
    },
    {
      path: "/spectrum",
      name: "spectrum",
      component: SpectrumView,
    },
  ],
});

export default router;
