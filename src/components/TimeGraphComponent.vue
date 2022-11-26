<template>
  <div class="timeline-graph my-3">
    <CanvasComponent
      ref="canvas"
      @draw="draw"
      @mousedown="mousedown"
      @mousemove="mousemove"
      @mouseup="mouseup"
      @wheel="wheel"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import {
  BlackboxFields,
  transformGyro,
  useBlackboxStore,
} from "@/stores/blackbox";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { useTimelineStore } from "@/stores/timeline";
import { Color } from "@/stores/render";

export default defineComponent({
  name: "TimeGraphComponent",
  components: {
    CanvasComponent,
  },
  props: {
    index: Number,
  },
  setup() {
    return {
      bb: useBlackboxStore(),
      tl: useTimelineStore(),
    };
  },
  data() {
    return {
      fields: [BlackboxFields.GYRO_RAW, BlackboxFields.GYRO_FILTER],
      drag: false,
    };
  },
  computed: {
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
  },
  methods: {
    mousedown() {
      this.drag = true;
    },
    mousemove(e: MouseEvent) {
      if (this.drag) {
        this.tl.moveCursor(this.canvas.width, e.movementX);
      }
      this.tl.setWindowHover(this.canvas.width, e.offsetX);
    },
    mouseup(e: MouseEvent) {
      this.tl.moveCursor(this.canvas.width, e.movementX);
      this.drag = false;
    },
    wheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();

      this.tl.modifyZoom(e.deltaY);
      this.tl.moveCursor(this.canvas.width, (e.deltaX * this.tl.zoom) / 10000);
    },
    draw(ctx: CanvasRenderingContext2D) {
      if (!this.tl.ready) {
        return;
      }

      const halfHeight = this.canvas.height / 2;
      const entriesPerMS = this.bb.entriesPerMS;
      const windowSize = Math.floor(this.tl.zoom * entriesPerMS);
      const offset = Math.floor(this.tl.cursor * entriesPerMS - windowSize / 2);
      const tickWidth = (this.canvas.width / this.tl.zoom) * entriesPerMS;

      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.strokeStyle = Color.GRAY_LIGTH;
      ctx.beginPath();
      const divs = 6;
      for (let i = 0; i <= divs; i++) {
        ctx.moveTo(0, (i * this.canvas.height) / divs);
        ctx.lineTo(this.canvas.width, (i * this.canvas.height) / divs);
      }
      ctx.stroke();

      let colorIndex = 0;
      for (const field of this.fields) {
        ctx.strokeStyle = this.tl.colors[colorIndex++];
        ctx.beginPath();
        ctx.moveTo(0, halfHeight);
        for (let i = 0; i < windowSize; i++) {
          const entry = this.bb.entries[offset + i];
          const val = transformGyro(entry[field][this.index || 0]) / 2000;
          ctx.lineTo(i * tickWidth, val * halfHeight + halfHeight);
        }
        ctx.stroke();
      }

      const hoverPos = this.tl.windowHoverPos(this.canvas.width);
      ctx.strokeStyle = Color.GREEN;
      ctx.beginPath();
      ctx.moveTo(hoverPos, 0);
      ctx.lineTo(hoverPos, this.canvas.height);
      ctx.stroke();

      const hoverIndex = offset + this.tl.hover * windowSize;
      const hoverIndexLower = Math.floor(hoverIndex);
      const hoverWeigthLower = hoverIndex - hoverIndexLower;
      const hoverIndexUpper = Math.ceil(hoverIndex);
      const hoverWeigthUpper = 1 - hoverWeigthLower;

      ctx.font = "14px Roboto Mono";
      ctx.textAlign = "right";

      colorIndex = 0;
      for (const field of this.fields) {
        const valUpper = transformGyro(
          this.bb.entries[hoverIndexUpper][field][this.index || 0]
        );
        const valLower = transformGyro(
          this.bb.entries[hoverIndexLower][field][this.index || 0]
        );

        const val = valUpper * hoverWeigthUpper + valLower * hoverWeigthLower;
        ctx.fillStyle = this.tl.colors[colorIndex];
        ctx.fillText(
          val.toFixed(2).toString() + " deg/s",
          hoverPos - 6,
          20 * (colorIndex + 1)
        );
        colorIndex++;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.timeline-graph {
  height: 300px;
}
</style>
