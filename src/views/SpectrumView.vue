<template>
  <h1 class="title" v-if="!sp.ready">No file loaded</h1>
  <div v-else>
    <SpectrumGraphComponent
      v-for="(fields, index) in sp.graphFields"
      :key="'spectrum-' + index"
      :fields="fields"
    />
  </div>

  <div class="sidebar" :class="{ 'is-visible': render.sidebar }">
    <button class="button is-primary mt-4" @click="sp.addGraph()">
      <font-awesome-icon icon="fa-solid fa-plus" size="lg" fixed-width />
      Graph
    </button>

    <div
      v-for="(graph, graphIndex) in sp.graphs"
      :key="'graph-config-' + graphIndex"
      class="mt-4"
    >
      <h4 class="subtitle is-4 mb-2">
        Graph {{ graphIndex + 1 }}
        <button
          class="delete mt-1"
          @click="sp.graphs.splice(graphIndex, 1)"
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
              <select v-model="sp.graphs[graphIndex].fields[fieldIndex].id">
                <template
                  v-for="(opt, index) in bb.fieldOptions"
                  :key="'field-optgtp-' + index"
                >
                  <optgroup>
                    <option
                      v-for="o in opt.filter((o: any) => !o.group)"
                      :key="'field-opt-' + o.id.name + '-' + o.id.index"
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
          <div class="control">
            <a
              class="button is-danger"
              @click="sp.graphs[graphIndex].fields.splice(fieldIndex, 1)"
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
            <select v-model="sp.fieldTemplate[graphIndex]">
              <option :value="undefined">Select...</option>
              <template
                v-for="(opt, index) in bb.fieldOptions"
                :key="'field-create-optgtp-' + index"
              >
                <optgroup>
                  <option
                    v-for="o in opt"
                    :key="'field-create-opt-' + o.id.name + '-' + o.id.index"
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
            @click="sp.addField(graphIndex)"
            :disabled="sp.fieldTemplate[graphIndex] == undefined"
          >
            <font-awesome-icon icon="fa-solid fa-plus" size="lg" fixed-width />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import { useRenderStore } from "@/stores/render";
import { useSpectrumStore } from "@/stores/spectrum";

import SpectrumGraphComponent from "@/components/SpectrumGraphComponent.vue";
import { useBlackboxStore } from "@/stores/blackbox";

export default defineComponent({
  name: "SpectrumView",
  components: {
    SpectrumGraphComponent,
  },
  setup() {
    return {
      render: useRenderStore(),
      sp: useSpectrumStore(),
      bb: useBlackboxStore(),
    };
  },
  data() {
    return {};
  },
  watch: {
    "sp.graphs": {
      handler(newValue) {
        localStorage.setItem("spectrum-graphs", JSON.stringify(newValue));
      },
      deep: true,
    },
  },
});
</script>

<style lang="scss" scoped></style>
