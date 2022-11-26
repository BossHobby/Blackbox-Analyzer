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
      </div>
    </div>

    <div class="navbar-end">
      <spinner-btn
        class="navbar-item button my-auto mr-2 is-primary"
        @click="bb.loadBlackbox()"
      >
        Load File
      </spinner-btn>
    </div>
  </nav>
</template>

<script lang="ts">
import { useBlackboxStore } from "@/stores/blackbox";
import { defineComponent } from "vue";

export default defineComponent({
  name: "NavComponent",
  setup() {
    return {
      bb: useBlackboxStore(),
    };
  },
});
</script>
