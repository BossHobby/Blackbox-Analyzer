<template>
  <nav
    class="navbar is-fixed-top is-primary"
    role="navigation"
    aria-label="main navigation"
  >
    <div class="navbar-brand">
      <router-link class="navbar-item py-1" to="/"> BB Analyzer </router-link>

      <a
        role="button"
        class="navbar-burger"
        aria-label="menu"
        aria-expanded="false"
        data-target="mainMavbar"
      >
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </a>
    </div>

    <div id="mainMavbar" class="navbar-menu">
      <div class="navbar-start">
        <router-link active-class="is-active" class="navbar-item" to="/">
          Timeline
        </router-link>
        <router-link
          active-class="is-active"
          class="navbar-item"
          to="/spectrum"
        >
          Spectrum
        </router-link>
      </div>
    </div>

    <div class="navbar-end"></div>
    <div class="navbar-end">
      <div class="navbar-item">
        <div class="buttons">
          <spinner-btn class="button is-primary" @click="bb.loadBlackbox()">
            Load File
          </spinner-btn>
        </div>
      </div>
      <a class="navbar-item" @click="render.toggleSidebar()">
        <font-awesome-icon icon="fa-solid fa-bars" size="lg" fixed-width />
      </a>
    </div>
  </nav>
</template>

<script lang="ts">
import { useBlackboxStore } from "@/stores/blackbox";
import { useRenderStore } from "@/stores/render";
import { defineComponent } from "vue";

export default defineComponent({
  name: "NavComponent",
  setup() {
    return {
      bb: useBlackboxStore(),
      render: useRenderStore(),
    };
  },
});
</script>
