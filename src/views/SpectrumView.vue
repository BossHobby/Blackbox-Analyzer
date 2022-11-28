<template>
  <h1 class="title" v-if="!sp.ready">No file loaded</h1>

  <SpectrumGraphComponent />

  <div class="sidebar" :class="{ 'is-visible': render.sidebar }"></div>
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
});
</script>

<style lang="scss" scoped></style>
