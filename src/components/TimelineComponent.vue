<template>
  <div class="timeline">
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
import { useBlackboxStore } from "@/stores/blackbox";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { Color } from "@/stores/render";
import { useTimelineStore } from "@/stores/timeline";

export default defineComponent({
  name: "TimelineComponent",
  components: {
    CanvasComponent,
  },
  setup() {
    return {
      bb: useBlackboxStore(),
      tl: useTimelineStore(),
    };
  },
  data() {
    return {
      drag: false,
    };
  },
  computed: {
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
  },
  methods: {
    mousedown(e: MouseEvent) {
      this.tl.setCursor(this.canvas.width, e.offsetX);
      this.drag = true;
    },
    mousemove(e: MouseEvent) {
      if (this.drag) {
        this.tl.setCursor(this.canvas.width, e.offsetX);
      }
    },
    mouseup() {
      this.drag = false;
    },
    wheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();

      this.tl.modifyZoom(e.deltaY / 500);
      this.tl.moveCursor(
        (e.deltaX * 0.05) / this.tl.pixelsPerMS(this.canvas.width)
      );
    },
    formatDuration(s: number) {
      const time: any = {
        minute: Math.floor(s / 60) % 60,
        second: Math.floor(s) % 60,
      };
      return Object.values(time)
        .map((v) => {
          let str = (v as number).toString();
          while (str.length < 2) str = "0" + str;
          return str;
        })
        .join(":");
    },
    draw(ctx: CanvasRenderingContext2D) {
      if (!this.tl.ready) {
        return;
      }

      const halfHeight = this.canvas.height / 2;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.strokeStyle = Color.GRAY_LIGTH;
      ctx.beginPath();
      ctx.moveTo(0, halfHeight);
      ctx.lineTo(this.canvas.width, halfHeight);
      ctx.stroke();

      const seconds = this.bb.duration >= 30 * 1000 ? 2 : 1;
      const tickWidth = seconds * 1000 * this.tl.pixelsPerMS(this.canvas.width);
      const ticks = Math.floor(this.canvas.width / tickWidth);
      for (let i = 1; i < ticks; i++) {
        const offset = i * tickWidth;
        ctx.strokeStyle = Color.GRAY_LIGTH;
        ctx.beginPath();
        ctx.moveTo(offset, halfHeight - halfHeight * 0.4);
        ctx.lineTo(offset, halfHeight + halfHeight * 0.4);
        ctx.stroke();

        ctx.font = "14px Roboto Mono";
        ctx.textAlign = "center";
        ctx.fillStyle = Color.WHITE_OFF;
        ctx.fillText(
          this.formatDuration(i * seconds),
          offset,
          this.canvas.height - 10
        );
      }

      const cursorPos = this.tl.cursorPos(this.canvas.width);
      const cursorWidth = this.tl.cursorWidth(this.canvas.width);

      ctx.fillStyle = "hsla(0, 0%, 29%, 0.4)";
      ctx.strokeStyle = Color.GRAY_LIGTHER;
      ctx.beginPath();
      ctx.moveTo(cursorPos - cursorWidth / 2, halfHeight + halfHeight * 0.4);
      ctx.lineTo(cursorPos + cursorWidth / 2, halfHeight + halfHeight * 0.4);
      ctx.lineTo(cursorPos + cursorWidth / 2, halfHeight - halfHeight * 0.4);
      ctx.lineTo(cursorPos - cursorWidth / 2, halfHeight - halfHeight * 0.4);
      ctx.lineTo(cursorPos - cursorWidth / 2, halfHeight + halfHeight * 0.4);
      ctx.stroke();
      ctx.fill();

      const hoverPos = this.tl.windowHoverPos(cursorWidth) - cursorWidth / 2;
      ctx.strokeStyle = Color.GREEN;
      ctx.beginPath();
      ctx.moveTo(cursorPos + hoverPos, halfHeight + halfHeight * 0.4);
      ctx.lineTo(cursorPos + hoverPos, halfHeight - halfHeight * 0.4);
      ctx.stroke();

      ctx.font = "14px Roboto Mono";
      ctx.textAlign = "center";
      ctx.fillStyle = Color.GREEN;
      ctx.fillText(
        this.formatDuration((seconds * cursorWidth) / tickWidth),
        cursorPos,
        halfHeight - halfHeight * 0.6
      );
    },
  },
});
</script>

<style lang="scss" scoped>
.timeline {
  height: 110px;
  width: 100%;
}
</style>
