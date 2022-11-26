<template>
  <div class="timeline-graph">
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
      graphPath: new Path2D(),
      drag: false,
    };
  },
  computed: {
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
    halfHeight() {
      return this.canvas.height / 2;
    },
    entriesPerMS() {
      return this.bb.entriesPerMS;
    },
    windowSize() {
      return Math.floor(this.tl.zoom * this.entriesPerMS);
    },
    windowOffset() {
      return Math.ceil(
        this.tl.cursor * this.entriesPerMS - this.windowSize / 2
      );
    },
    tickWidth() {
      return (this.canvas.width / this.tl.zoom) * this.entriesPerMS;
    },
    graphValues() {
      return this.bb.entries.map((entry) => {
        return this.fields.map((field) => {
          return transformGyro(entry[field][this.index || 0]) / 2000;
        });
      });
    },
    graphPaths() {
      return this.fields.map((_, fieldIndex) => {
        const path = new Path2D();

        path.moveTo(0, this.halfHeight);
        for (let i = 0; i < this.windowSize; i++) {
          const val = this.graphValues[this.windowOffset + i][fieldIndex];
          path.lineTo(
            i * this.tickWidth,
            val * this.halfHeight + this.halfHeight
          );
        }
        return path;
      });
    },
    hoverValues() {
      const hoverIndex = this.windowOffset + this.tl.hover * this.windowSize;
      const hoverIndexLower = Math.floor(hoverIndex);
      const hoverWeigthLower = hoverIndex - hoverIndexLower;
      const hoverIndexUpper = Math.ceil(hoverIndex);
      const hoverWeigthUpper = 1 - hoverWeigthLower;

      return this.fields.map((field) => {
        const valUpper = transformGyro(
          this.bb.entries[hoverIndexUpper][field][this.index || 0]
        );
        const valLower = transformGyro(
          this.bb.entries[hoverIndexLower][field][this.index || 0]
        );

        return valUpper * hoverWeigthUpper + valLower * hoverWeigthLower;
      });
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
      for (const path of this.graphPaths) {
        ctx.strokeStyle = this.tl.colors[colorIndex++];
        ctx.stroke(path);
      }

      const hoverPos = this.tl.windowHoverPos(this.canvas.width);
      ctx.strokeStyle = Color.GREEN;
      ctx.beginPath();
      ctx.moveTo(hoverPos, 0);
      ctx.lineTo(hoverPos, this.canvas.height);
      ctx.stroke();

      colorIndex = 0;
      ctx.font = "14px Roboto Mono";
      ctx.textAlign = "right";
      for (const val of this.hoverValues) {
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
