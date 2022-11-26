<template>
  <NavComponent />
  <div class="container-fluid router-outlet-container">
    <RouterView />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useRenderStore } from "./stores/render";

import NavComponent from "@/components/NavComponent.vue";

export default defineComponent({
  name: "App",
  components: {
    NavComponent,
  },
  setup() {
    return {
      render: useRenderStore(),
    };
  },
  mounted() {
    this.render.startRender();
  },
  unmounted() {
    this.render.stopRender();
  },
});
</script>

<style lang="scss" scoped>
.router-outlet-container {
  margin-top: 6rem !important;
  margin-bottom: 6rem !important;
}
</style>
