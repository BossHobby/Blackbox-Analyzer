<template>
  <section
    class="mx-auto mt-4 max-w-3xl rounded-lg border bg-panel p-6 transition-colors sm:p-8"
    :class="dragActive ? 'border-dashed border-accent' : 'border-line'"
    aria-labelledby="empty-state-title"
    @dragenter.prevent="dragActive = true"
    @dragover.prevent="dragActive = true"
    @dragleave.prevent="dragActive = false"
    @drop.prevent="dropFile"
  >
    <div class="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
      <img src="/logo-header.svg" alt="" class="size-24 shrink-0 sm:size-28" />
      <div class="min-w-0">
        <h2 id="empty-state-title" class="text-lg font-semibold">
          {{ title }}
        </h2>
        <p class="mt-1 max-w-prose text-sm text-muted">{{ subtitle }}</p>
        <p
          v-if="bb.loadState == LoadState.ERROR"
          role="alert"
          class="mt-4 flex items-start gap-2 rounded-md border border-danger px-3 py-2 text-sm text-danger"
        >
          <Icon name="warning" />{{ bb.loadError }}
        </p>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <UiButton
            variant="primary"
            :busy="bb.loadState == LoadState.LOADING"
            @click="bb.loadBlackbox()"
            ><Icon v-if="bb.loadState != LoadState.LOADING" name="upload" />Load
            blackbox file</UiButton
          ><span class="text-xs text-muted">or drop a .json log here</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import UiButton from "@/components/ui/Button.vue";
import Icon from "@/components/ui/Icon.vue";
import { BlackboxLoadState, useBlackboxStore } from "@/stores/blackbox";

export default defineComponent({
  name: "EmptyState",
  components: {
    UiButton,
    Icon,
  },
  setup() {
    return {
      bb: useBlackboxStore(),
      LoadState: BlackboxLoadState,
    };
  },
  data() {
    return {
      dragActive: false,
    };
  },
  computed: {
    title() {
      switch (this.bb.loadState) {
        case BlackboxLoadState.LOADING:
          return "Loading blackbox";
        case BlackboxLoadState.ERROR:
          return "Could not load blackbox";
        default:
          return "Load a blackbox to begin";
      }
    },
    subtitle() {
      switch (this.bb.loadState) {
        case BlackboxLoadState.LOADING:
          return "Parsing entries and preparing analysis presets.";
        case BlackboxLoadState.ERROR:
          return "Fix the file issue below, then try loading it again.";
        default:
          return "Timeline, spectrum, rover steering, and debug tools appear once a log is loaded.";
      }
    },
  },
  methods: {
    dropFile(e: DragEvent) {
      this.dragActive = false;
      const file = e.dataTransfer?.files?.[0];
      if (!file) {
        return;
      }
      this.bb.loadBlackboxFile(file);
    },
  },
});
</script>
