<template>
  <h1 v-if="!tl.ready">No file loaded</h1>
  <div style="margin-top: 60px; margin-bottom: 120px">
    <TimeGraphComponent :index="0" />
    <TimeGraphComponent :index="1" />
    <TimeGraphComponent :index="2" />
  </div>

  <div class="navbar is-fixed-bottom has-shadow">
    <TimelineComponent />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useTimelineStore } from "@/stores/timeline";
import TimeGraphComponent from "@/components/TimeGraphComponent.vue";
import TimelineComponent from "@/components/TimelineComponent.vue";

export default defineComponent({
  name: "TimelineView",
  components: {
    TimeGraphComponent,
    TimelineComponent,
  },
  setup() {
    return {
      tl: useTimelineStore(),
    };
  },
});
</script>

<style lang="scss"></style>
