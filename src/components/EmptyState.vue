<template>
  <section
    class="empty-state hero is-primary"
    :class="{ 'is-dragging': dragActive }"
    @dragenter.prevent="dragActive = true"
    @dragover.prevent="dragActive = true"
    @dragleave.prevent="dragActive = false"
    @drop.prevent="dropFile"
  >
    <div class="hero-body">
      <div class="empty-state-content">
        <div class="empty-state-mark">
          <img src="/logo-header.svg" alt="" class="empty-state-logo" />
        </div>
        <div class="empty-state-copy">
          <p class="title is-3 is-spaced mb-2">{{ title }}</p>
          <p class="subtitle is-5 mb-4 empty-state-subtitle">
            {{ subtitle }}
          </p>
          <div
            v-if="bb.loadState == LoadState.ERROR"
            class="notification is-danger"
          >
            {{ bb.loadError }}
          </div>
          <spinner-btn
            class="button is-primary is-light"
            :disabled="bb.loadState == LoadState.LOADING"
            @click="bb.loadBlackbox()"
          >
            {{
              bb.loadState == LoadState.LOADING
                ? "Loading..."
                : "Load blackbox file"
            }}
          </spinner-btn>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import SpinnerBtn from "@/components/SpinnerBtn.vue";
import { BlackboxLoadState, useBlackboxStore } from "@/stores/blackbox";

export default defineComponent({
  name: "EmptyState",
  components: {
    SpinnerBtn,
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

<style lang="scss" scoped>
.empty-state {
  border-radius: 0.5rem;
  box-shadow: 0 0.5em 1em -0.125em rgb(3 3 3 / 35%);
  margin: 2rem auto;
  max-width: 920px;
  outline: 2px solid transparent;
  outline-offset: 0;
  transition: outline-color 120ms ease, transform 120ms ease;
}

.empty-state.is-dragging {
  outline-color: rgb(233 235 252 / 80%);
  transform: translateY(-1px);
}

.empty-state :deep(.hero-body) {
  padding: 2rem;
}

.empty-state-content {
  align-items: center;
  display: flex;
  gap: 1.5rem;
}

.empty-state-mark {
  flex: 0 0 7rem;
}

.empty-state-copy {
  min-width: 0;
}

.empty-state-logo {
  display: block;
  margin: 0 auto;
  max-width: 8rem;
  width: 100%;
}

.empty-state-subtitle {
  line-height: 1.35;
  margin-top: 0 !important;
  max-width: 34rem;
}

@media screen and (max-width: 768px) {
  .empty-state-content {
    align-items: flex-start;
    flex-direction: column;
  }

  .empty-state-mark {
    flex-basis: auto;
  }

  .empty-state-logo {
    margin: 0;
    max-width: 6rem;
  }
}
</style>
