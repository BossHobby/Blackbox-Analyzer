<template>
  <h1 v-if="!tl.ready">No file loaded</h1>
  <TimeGraphComponent :index="0" />
  <TimeGraphComponent :index="1" />
  <TimeGraphComponent :index="2" />
  <TimelineComponent />
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
  data() {
    return {};
  },
  computed: {},
  methods: {},
});
</script>

<style lang="scss"></style>
