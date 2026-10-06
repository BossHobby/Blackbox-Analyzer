<template>
  <div ref="canvasContainer" class="size-full">
    <canvas ref="canvas" />
  </div>
</template>

<script lang="ts">
import { useRenderStore } from "@/stores/render";
import { defineComponent } from "vue";

export default defineComponent({
  name: "CanvasComponent",
  emits: ["draw"],
  setup() {
    return {
      render: useRenderStore(),
    };
  },
  data() {
    return {
      ctx: undefined as CanvasRenderingContext2D | undefined,
      ro: undefined as ResizeObserver | undefined,
      renderId: 0,
      width: 0,
      height: 0,
    };
  },
  computed: {
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
    canvasContainer() {
      return this.$refs.canvasContainer as HTMLElement;
    },
  },
  mounted() {
    this.ctx = this.canvas.getContext("2d")!;
    this.canvasResize();
    this.ro = new ResizeObserver(this.canvasResize);
    this.ro.observe(this.canvasContainer);
    this.renderId = this.render.subscribeDraw((time) =>
      this.$emit("draw", this.ctx, time),
    );
  },
  unmounted() {
    this.ro?.unobserve(this.canvasContainer);
    this.render.unsubscribeDraw(this.renderId);
  },
  methods: {
    canvasResize() {
      if (!this.canvas || !this.canvasContainer) {
        return;
      }
      this.width = this.canvas.width = this.canvasContainer.clientWidth;
      this.height = this.canvas.height = this.canvasContainer.clientHeight;
    },
  },
});
</script>
