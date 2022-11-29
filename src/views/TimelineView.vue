<template>
  <h1 class="title" v-if="!tl.ready">No file loaded</h1>
  <div style="margin-top: 60px; margin-bottom: 120px">
    <TimeGraphComponent
      v-for="(graph, index) in tl.graphs"
      :key="'graph-' + index"
      :fields="graph.fields"
    />
  </div>

  <div class="sidebar" :class="{ 'is-visible': render.sidebar }">
    <div class="p-2">
      Smoothing
      <input
        type="range"
        min="0"
        max="100"
        v-model.lazy="tl.smoothing"
        step="1"
      />
      {{ tl.smoothing }}
    </div>

    <div class="p-2">
      Expo
      <input type="range" min="0" max="1" v-model.lazy="tl.expo" step="0.01" />
      {{ tl.expo }}
    </div>

    <button class="button is-primary mt-4" @click="tl.addGraph()">
      <font-awesome-icon icon="fa-solid fa-plus" size="lg" fixed-width />
      Graph
    </button>

    <div
      v-for="(graph, graphIndex) in tl.graphs"
      :key="'graph-config-' + graphIndex"
      class="mt-4"
    >
      <h4 class="subtitle is-4 mb-2">
        Graph {{ graphIndex + 1 }}
        <button
          class="delete mt-1"
          @click="tl.graphs.splice(graphIndex, 1)"
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
              <select v-model="tl.graphs[graphIndex].fields[fieldIndex]">
                <template
                  v-for="(opt, index) in fieldOptions"
                  :key="'field-optgtp-' + index"
                >
                  <optgroup>
                    <option
                      v-for="o in opt.filter((o: any) => !o.group)"
                      :key="'field-opt-' + o.name"
                      :value="o"
                    >
                      {{ o.title }}
                    </option>
                    <option v-if="opt.length == 0" :value="opt">
                      {{ opt.title }}
                    </option>
                  </optgroup>
                </template>
              </select>
            </div>
          </div>
          <div class="control">
            <a
              class="button is-danger"
              @click="tl.graphs[graphIndex].fields.splice(fieldIndex, 1)"
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
            <select v-model="tl.fieldTemplate[graphIndex]">
              <option :value="null">Select...</option>
              <template
                v-for="(opt, index) in fieldOptions"
                :key="'field-create-optgtp-' + index"
              >
                <optgroup>
                  <option
                    v-for="o in opt"
                    :key="'field-create-opt-' + o.name"
                    :value="o"
                  >
                    {{ o.title }}
                  </option>
                  <option v-if="opt.length == 0" :value="opt">
                    {{ opt.title }}
                  </option>
                </optgroup>
              </template>
            </select>
          </div>
        </div>
        <div class="control">
          <button
            class="button is-primary"
            @click="tl.addField(graphIndex)"
            :disabled="tl.fieldTemplate[graphIndex] == null"
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
import { useBlackboxStore } from "@/stores/blackbox";

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
      render: useRenderStore(),
      tl: useTimelineStore(),
      bb: useBlackboxStore(),
    };
  },
  data() {
    return {};
  },
  watch: {
    "tl.graphs": {
      handler(newValue) {
        localStorage.setItem("timeline-graphs", JSON.stringify(newValue));
      },
      deep: true,
    },
  },
  computed: {
    fieldOptions() {
      const options = [[]] as any[];
      const fields = Object.values(this.bb.fields);

      for (const field of fields) {
        if (!Array.isArray(field?.axis)) {
          options[0].push(field);
          continue;
        }

        const opt: any[] = [
          {
            ...field,
            title: field.title + " All",
            groupTitle: field.title,
            group: field?.axis.length,
          },
          ...field.axis.map((name, index) => {
            return {
              ...field,
              title: field.title + " " + name,
              index,
            };
          }),
        ];
        options.push(opt);
      }

      return options;
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
  transition: all 400ms ease-in-out;

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
