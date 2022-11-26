import { createRouter, createWebHistory } from "vue-router";
import TimelineView from "../views/TimelineView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "timeline",
      component: TimelineView,
    },
  ],
});

export default router;
