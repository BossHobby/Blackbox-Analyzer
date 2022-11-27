<template>
  <h1 v-if="!tl.ready">No file loaded</h1>
  <div style="margin-top: 60px; margin-bottom: 120px">
    <TimeGraphComponent
      v-for="(graph, index) in graphs"
      :key="'graph-' + index"
      :fields="graph.fields"
    />
  </div>

  <div class="sidebar" :class="{ 'is-visible': render.sidebar }">
    <button class="button is-primary mt-4" @click="addGraph()">
      <font-awesome-icon icon="fa-solid fa-plus" size="lg" fixed-width />
      Graph
    </button>

    <div
      v-for="(graph, graphIndex) in graphs"
      :key="'graph-config-' + graphIndex"
      class="mt-4"
    >
      <h4 class="subtitle is-4 mb-2">
        Graph {{ graphIndex + 1 }}
        <button
          class="delete mt-1"
          @click="graphs.splice(graphIndex, 1)"
        ></button>
      </h4>

      <div
        v-for="(field, fieldIndex) in graph.fields"
        :key="'field-' + field.name"
        class="mb-2"
      >
        <div class="field has-addons">
          <div class="control">
            <div class="select">
              <select v-model="graphs[graphIndex].fields[fieldIndex]">
                <option
                  v-for="opt in fieldOptions"
                  :key="'field-opt-' + opt.name"
                  :value="opt"
                >
                  {{ opt.title }}
                </option>
              </select>
            </div>
          </div>
          <div class="control">
            <a
              class="button is-danger"
              @click="graphs[graphIndex].fields.splice(fieldIndex, 1)"
            >
              <font-awesome-icon
                icon="fa-solid fa-xmark"
                size="lg"
                fixed-width
              />
            </a>
          </div>
        </div>
      </div>

      <div class="field has-addons">
        <div class="control">
          <div class="select">
            <select v-model="fieldTemplate[graphIndex]">
              <option :value="null">Select...</option>
              <option
                v-for="opt in fieldOptions"
                :key="'field-opt-' + opt.name"
                :value="opt"
              >
                {{ opt.title }}
              </option>
            </select>
          </div>
        </div>
        <div class="control">
          <button
            class="button is-primary"
            @click="addField(graphIndex)"
            :disabled="fieldTemplate[graphIndex] == null"
          >
            <font-awesome-icon icon="fa-solid fa-plus" size="lg" fixed-width />
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="navbar is-fixed-bottom has-shadow" style="z-index: 20">
    <TimelineComponent />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useTimelineStore } from "@/stores/timeline";
import { useRenderStore } from "@/stores/render";

import TimeGraphComponent from "@/components/TimeGraphComponent.vue";
import TimelineComponent from "@/components/TimelineComponent.vue";
import { useBlackboxStore } from "@/stores/blackbox";

export default defineComponent({
  name: "TimelineView",
  components: {
    TimeGraphComponent,
    TimelineComponent,
  },
  setup() {
    return {
      render: useRenderStore(),
      tl: useTimelineStore(),
      bb: useBlackboxStore(),
    };
  },
  data() {
    return {
      fieldTemplate: [null],
      graphs: [
        {
          fields: [] as any[],
        },
      ],
    };
  },
  computed: {
    fieldOptions() {
      return Object.values(this.bb.fields).flatMap((field) => {
        if (Array.isArray(field?.axis)) {
          return field?.axis.map((name, index) => {
            return {
              ...field,
              title: field.title + " " + name,
              index,
            };
          });
        }
        return [field];
      });
    },
  },
  methods: {
    addField(graphIndex: number) {
      this.graphs[graphIndex].fields.push(this.fieldTemplate[graphIndex]);
      this.fieldTemplate[graphIndex] = null;
    },
    addGraph() {
      this.graphs.push({
        fields: [] as any[],
      });
      this.fieldTemplate.push(null);
    },
  },
});
</script>

<style lang="scss">
@import "./src/style.scss";
.sidebar {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;

  background-color: $background;
  z-index: 25;

  padding-top: 4rem;
  padding-bottom: 110px;

  box-shadow: -0.1em 0 0.125em rgb(8 8 8 / 30%);

  width: 0;
  transition: width 400ms;

  & > * {
    opacity: 0;
  }

  &.is-visible {
    padding-left: 1rem;
    padding-right: 1rem;
    width: 320px;

    & > * {
      opacity: 1;
    }
  }
}
</style>
