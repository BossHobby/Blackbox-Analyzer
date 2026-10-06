<template>
  <EmptyState v-if="!bb.isLoaded" />
  <template v-else>
    <LogSummary />
    <div class="mt-3 flex min-w-0 flex-col gap-3">
      <template
        v-for="(fields, index) in sp.graphFields"
        :key="'spectrum-' + index"
      >
        <GraphCard
          v-if="fields.length"
          :title="sp.graphs[index].title || `Graph ${index + 1}`"
        >
          <SpectrumGraphComponent :fields="fields" :graph-index="index" />
        </GraphCard>
      </template>
      <p
        v-if="!hasVisibleGraphs"
        role="status"
        class="flex items-start gap-2 rounded-lg border border-warning bg-panel p-4 text-sm text-warning"
      >
        <Icon name="warning" />No valid spectrum fields are selected. Add fields
        in the graph settings or apply the default preset.
      </p>
    </div>
  </template>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import { useSpectrumStore } from "@/stores/spectrum";
import { useBlackboxStore } from "@/stores/blackbox";

import GraphCard from "@/components/GraphCard.vue";
import Icon from "@/components/ui/Icon.vue";
import SpectrumGraphComponent from "@/components/SpectrumGraphComponent.vue";
import EmptyState from "@/components/EmptyState.vue";
import LogSummary from "@/components/LogSummary.vue";

export default defineComponent({
  name: "SpectrumView",
  components: {
    GraphCard,
    Icon,
    SpectrumGraphComponent,
    EmptyState,
    LogSummary,
  },
  setup() {
    return {
      sp: useSpectrumStore(),
      bb: useBlackboxStore(),
    };
  },
  computed: {
    hasVisibleGraphs() {
      return this.sp.graphFields.some((fields) => fields.length);
    },
  },
  watch: {
    "sp.graphs": {
      handler(newValue) {
        try {
          localStorage.setItem("spectrum-graphs", JSON.stringify(newValue));
        } catch {
          /* Graphs still work without persistence. */
        }
      },
      deep: true,
    },
  },
});
</script>
