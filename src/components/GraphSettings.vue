<template>
  <section aria-label="Graph settings" class="min-w-0">
    <header
      class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-panel px-4 py-3"
    >
      <h2 class="text-base font-semibold">Graphs</h2>
      <div class="flex flex-wrap gap-2">
        <UiButton @click="store.applyDefaultGraphs(bb.isRoverLog)">
          {{ bb.vehicleLabel ? bb.vehicleLabel + " preset" : "Default preset" }}
        </UiButton>
        <UiButton variant="primary" @click="store.addGraph()"
          ><Icon name="plus" />Graph</UiButton
        >
      </div>
    </header>
    <section
      v-for="(graph, graphIndex) in store.graphs"
      :key="'graph-config-' + graphIndex"
      class="border-b border-line px-4 py-4 last:border-b-0"
      :aria-label="graph.title || `Graph ${graphIndex + 1}`"
    >
      <div class="mb-3 flex items-center gap-2">
        <label :for="`graph-title-${graphIndex}`" class="sr-only"
          >Graph {{ graphIndex + 1 }} title</label
        >
        <input
          :id="`graph-title-${graphIndex}`"
          v-model="graph.title"
          class="form-input font-medium"
          type="text"
          :placeholder="`Graph ${graphIndex + 1}`"
        />
        <button
          type="button"
          class="form-dismiss"
          :aria-label="`Remove graph ${graphIndex + 1}`"
          @click="store.removeGraph(graphIndex)"
        ></button>
      </div>

      <div
        v-if="expo && graph.fields.length"
        class="mb-1 grid grid-cols-[1fr_4.5rem_1.75rem] gap-2 text-xs text-muted"
      >
        <span>Field</span><span>Expo</span>
      </div>
      <div
        v-for="(field, fieldIndex) in graph.fields"
        :key="'field-' + graphIndex + '-' + fieldIndex"
        class="mb-2 grid items-center gap-2"
        :class="
          expo ? 'grid-cols-[1fr_4.5rem_1.75rem]' : 'grid-cols-[1fr_1.75rem]'
        "
      >
        <div class="relative min-w-0">
          <select
            v-model="field.id"
            class="form-select"
            :aria-label="`Graph ${graphIndex + 1} field ${fieldIndex + 1}`"
          >
            <option :value="undefined">Select source…</option>
            <optgroup
              v-for="(group, index) in bb.fieldOptions"
              :key="'field-optgroup-' + index"
              :label="group[0]?.groupTitle || 'Fields'"
            >
              <option
                v-for="o in group.filter((o: any) => !o.group)"
                :key="'field-opt-' + fieldIdToString(o.id)"
                :value="o.id"
              >
                {{ o.title }}
              </option>
            </optgroup></select
          ><Icon
            name="chevron"
            class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
          />
        </div>
        <input
          v-if="expo && 'expo' in field"
          v-model.number="field.expo"
          class="form-input"
          type="number"
          step="1"
          min="0"
          max="100"
          :aria-label="`Graph ${graphIndex + 1} field ${fieldIndex + 1} expo`"
        />
        <button
          type="button"
          class="form-dismiss"
          :aria-label="`Remove field ${fieldIndex + 1}`"
          @click="graph.fields.splice(fieldIndex, 1)"
        ></button>
      </div>

      <UiButton class="mt-1" @click="store.addField(graphIndex)"
        ><Icon name="plus" />Field</UiButton
      >
    </section>
  </section>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import UiButton from "@/components/ui/Button.vue";
import Icon from "@/components/ui/Icon.vue";
import { blackboxFieldIDToString, useBlackboxStore } from "@/stores/blackbox";
import { useSpectrumStore } from "@/stores/spectrum";
import { useTimelineStore } from "@/stores/timeline";

export default defineComponent({
  name: "GraphSettings",
  components: {
    UiButton,
    Icon,
  },
  props: {
    kind: {
      type: String as PropType<"timeline" | "spectrum">,
      required: true,
    },
  },
  setup(props) {
    return {
      store: props.kind == "timeline" ? useTimelineStore() : useSpectrumStore(),
      expo: props.kind == "timeline",
      bb: useBlackboxStore(),
      fieldIdToString: blackboxFieldIDToString,
    };
  },
});
</script>
