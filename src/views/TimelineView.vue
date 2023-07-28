<template>
  <h1 class="title" v-if="!tl.ready">No file loaded</h1>
  <div style="margin-top: 60px; margin-bottom: 120px">
    <StickOverlay />
    <TimeGraphComponent
      v-for="(fields, index) in tl.graphFields"
      :key="'graph-' + index"
      :fields="fields"
    />
  </div>

  <div class="sidebar" :class="{ 'is-visible': render.sidebar }">
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
        :key="'field-' + field.id.toString()"
        class="mb-2"
      >
        <div class="field has-addons">
          <div class="control">
            <div class="select">
              <select v-model="tl.graphs[graphIndex].fields[fieldIndex].id">
                <template
                  v-for="(opt, index) in bb.fieldOptions"
                  :key="'field-optgtp-' + index"
                >
                  <optgroup>
                    <option
                      v-for="o in opt.filter((o: any) => !o.group)"
                      :key="'field-opt-' + o.name"
                      :value="o.id"
                    >
                      {{ o.title }}
                    </option>
                    <option v-if="opt.length == 0" :value="opt.id">
                      {{ opt.title }}
                    </option>
                  </optgroup>
                </template>
              </select>
            </div>
          </div>
          <p class="control">
            <input
              class="input"
              type="number"
              step="1"
              min="0"
              max="100"
              v-model="tl.graphs[graphIndex].fields[fieldIndex].expo"
            />
          </p>
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
              <option :value="undefined">Select...</option>
              <template
                v-for="(opt, index) in bb.fieldOptions"
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
            :disabled="tl.fieldTemplate[graphIndex] == undefined"
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
import StickOverlay from "@/components/StickOverlay.vue";

export default defineComponent({
  name: "TimelineView",
  components: {
    TimeGraphComponent,
    TimelineComponent,
    StickOverlay,
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
  computed: {},
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
    width: 350px;

    & > * {
      opacity: 1;
    }
  }
}
</style>
