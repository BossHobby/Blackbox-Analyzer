<template>
  <Shell
    :active="$route.path"
    :navigation="navigation"
    :title="bb.isLoaded ? bb.profileName || bb.filename : ''"
    :detail="
      bb.isLoaded
        ? `${bb.sampleFrequency.toFixed(0)} Hz · ${formatDuration(bb.duration)}`
        : ''
    "
    :ready="bb.isLoaded"
    :status="status"
    :sidebar="bb.isLoaded && render.sidebar && hasGraphSettings"
  >
    <template #connection>
      <div class="flex items-center gap-2">
        <UiButton
          v-if="bb.isLoaded && hasGraphSettings"
          aria-label="Graphs"
          :aria-pressed="render.sidebar"
          :class="render.sidebar ? 'bg-active' : ''"
          @click="render.toggleSidebar()"
          ><Icon name="settings" /><span class="hidden sm:inline"
            >Graphs</span
          ></UiButton
        >
        <UiButton
          variant="primary"
          aria-label="Load File"
          :busy="bb.loadState == LoadState.LOADING"
          @click="bb.loadBlackbox()"
          ><Icon v-if="bb.loadState != LoadState.LOADING" name="upload" /><span
            class="hidden sm:inline"
            >Load File</span
          ></UiButton
        >
      </div>
    </template>
    <template #sidebar>
      <GraphSettings
        :key="String($route.name)"
        :kind="$route.name == 'spectrum' ? 'spectrum' : 'timeline'"
      />
    </template>
    <RouterView />
    <template #footer>
      <TimelineFooter v-if="$route.name == 'timeline' && bb.isLoaded" />
    </template>
  </Shell>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useRenderStore } from "./stores/render";
import {
  BlackboxLoadState,
  formatDuration,
  useBlackboxStore,
} from "./stores/blackbox";

import Shell from "@/components/ui/Shell.vue";
import UiButton from "@/components/ui/Button.vue";
import Icon, { type IconName } from "@/components/ui/Icon.vue";
import TimelineFooter from "@/components/TimelineFooter.vue";
import GraphSettings from "@/components/GraphSettings.vue";

const navigation: { id: string; label: string; icon: IconName }[] = [
  { id: "/", label: "Overview", icon: "overview" },
  { id: "/timeline", label: "Timeline", icon: "timeline" },
  { id: "/spectrum", label: "Spectrum", icon: "spectrum" },
];

export default defineComponent({
  name: "App",
  components: {
    Shell,
    UiButton,
    Icon,
    TimelineFooter,
    GraphSettings,
  },
  setup() {
    return {
      render: useRenderStore(),
      bb: useBlackboxStore(),
      navigation,
      formatDuration,
      LoadState: BlackboxLoadState,
    };
  },
  computed: {
    hasGraphSettings() {
      return this.$route.name == "timeline" || this.$route.name == "spectrum";
    },
    status() {
      switch (this.bb.loadState) {
        case BlackboxLoadState.LOADING:
          return "Loading…";
        case BlackboxLoadState.ERROR:
          return "Load failed";
        case BlackboxLoadState.LOADED:
          return "Loaded";
        default:
          return "No file loaded";
      }
    },
  },
  mounted() {
    this.render.startRender();
    if (import.meta.env.DEV) {
      this.bb.restoreLastBlackbox();
    }
  },
  unmounted() {
    this.render.stopRender();
  },
});
</script>
