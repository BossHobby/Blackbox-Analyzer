<template>
  <nav
    class="navbar is-fixed-top is-primary"
    role="navigation"
    aria-label="main navigation"
  >
    <div class="navbar-brand">
      <router-link class="navbar-item py-1 brand" to="/">
        <img src="/logo-header.svg" alt="" class="brand-logo" />
        <span class="brand-text">GUACALYZER</span>
      </router-link>

      <a
        role="button"
        class="navbar-burger"
        :class="{ 'is-active': menuOpen }"
        aria-label="menu"
        :aria-expanded="menuOpen"
        data-target="mainNavbar"
        @click="menuOpen = !menuOpen"
      >
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </a>
    </div>

    <div id="mainNavbar" class="navbar-menu" :class="{ 'is-active': menuOpen }">
      <div class="navbar-start">
        <router-link
          active-class="is-active"
          class="navbar-item"
          to="/"
          @click="menuOpen = false"
        >
          Timeline
        </router-link>
        <router-link
          active-class="is-active"
          class="navbar-item"
          to="/spectrum"
          @click="menuOpen = false"
        >
          Spectrum
        </router-link>
      </div>

      <div class="navbar-end">
        <div class="navbar-item">
          <span
            v-if="bb.loadState == LoadState.ERROR"
            class="has-text-danger-light"
          >
            {{ bb.loadError }}
          </span>
          <span v-else-if="bb.loadState == LoadState.LOADING">Loading...</span>
          <span v-else-if="bb.isLoaded">
            {{ bb.filename }} · {{ formatDuration(bb.duration) }}
          </span>
          <span v-else class="has-text-grey-lighter">No file loaded</span>
        </div>
        <div class="navbar-item">
          <div class="buttons">
            <spinner-btn class="button is-primary" @click="loadBlackbox()">
              {{ bb.loadState == LoadState.LOADING ? "Loading..." : "Load File" }}
            </spinner-btn>
          </div>
        </div>
        <a class="navbar-item" @click="toggleSidebar()">
          <font-awesome-icon icon="fa-solid fa-bars" size="lg" fixed-width />
        </a>
      </div>
    </div>
  </nav>
</template>

<script lang="ts">
import { BlackboxLoadState, useBlackboxStore } from "@/stores/blackbox";
import { formatDuration } from "@/stores/blackbox";
import { useRenderStore } from "@/stores/render";
import { defineComponent } from "vue";

export default defineComponent({
  name: "NavComponent",
  setup() {
    return {
      bb: useBlackboxStore(),
      formatDuration,
      LoadState: BlackboxLoadState,
      render: useRenderStore(),
    };
  },
  data() {
    return {
      menuOpen: false,
    };
  },
  methods: {
    loadBlackbox() {
      this.menuOpen = false;
      this.bb.loadBlackbox();
    },
    toggleSidebar() {
      this.menuOpen = false;
      this.render.toggleSidebar();
    },
  },
});
</script>

<style lang="scss" scoped>
.brand {
  gap: 0.55rem;
  min-width: 13rem;
  position: relative;
}

.brand-logo {
  max-height: 3rem;
  width: 3rem;
}

.brand-text {
  color: #e9ebfc;
  font-size: 1.08rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1;
  text-shadow: 0 1px 0 rgb(0 0 0 / 45%), 0 0 12px rgb(233 235 252 / 18%);
}
</style>
