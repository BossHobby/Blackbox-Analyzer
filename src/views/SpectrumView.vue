<template>
  <h1 class="title" v-if="!sp.ready">No file loaded</h1>
  <div v-else>
    <SpectrumGraphComponent
      v-for="(graph, index) of graphs"
      :key="'spectrum-' + index"
      :fields="graph.fields"
    />
  </div>

  <div class="sidebar" :class="{ 'is-visible': render.sidebar }">
    <div class="p-2">
      Smoothing
      <input type="range" min="1" max="100" v-model="sp.smoothing" step="1" />
      {{ sp.smoothing }}
    </div>
    <div class="p-2">
      displayRangeX
      <input
        type="range"
        min="1"
        max="100"
        v-model="sp.displayRangeX"
        step="0.001"
      />
      {{ sp.displayRangeX }}
    </div>
    <div class="p-2">
      displayRangeY
      <input
        type="range"
        min="1"
        max="1000"
        v-model="sp.displayRangeY"
        step="0.001"
      />
      {{ sp.displayRangeY }}
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import { useRenderStore } from "@/stores/render";
import { useSpectrumStore } from "@/stores/spectrum";

import SpectrumGraphComponent from "@/components/SpectrumGraphComponent.vue";

export default defineComponent({
  name: "SpectrumView",
  components: {
    SpectrumGraphComponent,
  },
  setup() {
    return {
      render: useRenderStore(),
      sp: useSpectrumStore(),
    };
  },
  data() {
    return {
      graphs: [
        {
          fields: [
            { name: "gyro_raw", index: 0 },
            { name: "gyro_filter", index: 0 },
          ],
        },
        {
          fields: [{ name: "pid_dterm", index: 0 }],
        },
      ],
    };
  },
});
</script>

<style lang="scss" scoped></style>
