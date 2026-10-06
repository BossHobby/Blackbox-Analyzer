<template>
  <EmptyState v-if="!bb.isLoaded" />
  <template v-else>
    <LogSummary>
      <span class="rounded border border-line bg-panel px-2 py-1"
        >Window {{ formatDuration(tl.zoom) }}</span
      >
    </LogSummary>
    <div class="mt-3 flex min-w-0 flex-col gap-3">
      <template
        v-for="(fields, index) in tl.graphFields"
        :key="'graph-' + index"
      >
        <GraphCard
          v-if="fields.length"
          :title="tl.graphs[index].title || `Graph ${index + 1}`"
        >
          <TimeGraphComponent :fields="fields" />
        </GraphCard>
      </template>
      <p
        v-if="!hasVisibleGraphs"
        role="status"
        class="flex items-start gap-2 rounded-lg border border-warning bg-panel p-4 text-sm text-warning"
      >
        <Icon name="warning" />No valid timeline fields are selected. Add fields
        in the graph settings or apply the default preset.
      </p>
    </div>
  </template>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import { useTimelineStore } from "@/stores/timeline";
import { formatDuration, useBlackboxStore } from "@/stores/blackbox";

import GraphCard from "@/components/GraphCard.vue";
import Icon from "@/components/ui/Icon.vue";
import TimeGraphComponent from "@/components/TimeGraphComponent.vue";
import EmptyState from "@/components/EmptyState.vue";
import LogSummary from "@/components/LogSummary.vue";

export default defineComponent({
  name: "TimelineView",
  components: {
    GraphCard,
    Icon,
    TimeGraphComponent,
    EmptyState,
    LogSummary,
  },
  setup() {
    return {
      tl: useTimelineStore(),
      bb: useBlackboxStore(),
      formatDuration,
    };
  },
  computed: {
    hasVisibleGraphs() {
      return this.tl.graphFields.some((fields) => fields.length);
    },
  },
  watch: {
    "tl.graphs": {
      handler(newValue) {
        try {
          localStorage.setItem("timeline-graphs", JSON.stringify(newValue));
        } catch {
          /* Graphs still work without persistence. */
        }
      },
      deep: true,
    },
  },
});
</script>
