<template>
  <div>
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
import { useTimelineStore } from "@/stores/timeline";
import { monoFont } from "@/analysis/render";
import { useChartTheme } from "@/ui/useChartTheme";

export default defineComponent({
  name: "TimelineComponent",
  components: {
    CanvasComponent,
  },
  setup() {
    return {
      bb: useBlackboxStore(),
      tl: useTimelineStore(),
      theme: useChartTheme(),
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
      const pos = e.offsetX / this.tl.pixelsPerMS(this.canvas.width);
      this.tl.setCursor(pos);
      this.drag = true;
    },
    mousemove(e: MouseEvent) {
      if (this.drag) {
        const pos = e.offsetX / this.tl.pixelsPerMS(this.canvas.width);
        this.tl.setCursor(pos);
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
        (e.deltaX * 0.05) / this.tl.pixelsPerMS(this.canvas.width),
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

      const theme = this.theme;
      const halfHeight = this.canvas.height / 2;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.strokeStyle = theme.grid;
      ctx.beginPath();
      ctx.moveTo(0, halfHeight);
      ctx.lineTo(this.canvas.width, halfHeight);
      ctx.stroke();

      // Keep tick labels from overlapping on narrow screens.
      const tickCount = Math.max(
        Math.min(Math.floor(this.canvas.width / 72), 25),
        1,
      );
      const tickDuration = this.bb.duration / tickCount;
      const tickWidth = tickDuration * this.tl.pixelsPerMS(this.canvas.width);
      if (!Number.isFinite(tickWidth) || tickWidth <= 0) {
        return;
      }
      const ticks = Math.floor(this.canvas.width / tickWidth);
      for (let i = 1; i < ticks; i++) {
        const offset = i * tickWidth;
        ctx.strokeStyle = theme.grid;
        ctx.beginPath();
        ctx.moveTo(offset, halfHeight - halfHeight * 0.4);
        ctx.lineTo(offset, halfHeight + halfHeight * 0.4);
        ctx.stroke();

        ctx.font = monoFont(12);
        ctx.textAlign = "center";
        ctx.fillStyle = theme.text;
        ctx.fillText(
          this.formatDuration(i * (tickDuration / 1000)),
          offset,
          this.canvas.height - 10,
        );
      }

      const cursorPos = this.tl.cursorPos(this.canvas.width);
      const cursorWidth = this.tl.cursorWidth(this.canvas.width);

      ctx.fillStyle = theme.selection;
      ctx.strokeStyle = theme.text;
      ctx.beginPath();
      ctx.moveTo(cursorPos - cursorWidth / 2, halfHeight + halfHeight * 0.4);
      ctx.lineTo(cursorPos + cursorWidth / 2, halfHeight + halfHeight * 0.4);
      ctx.lineTo(cursorPos + cursorWidth / 2, halfHeight - halfHeight * 0.4);
      ctx.lineTo(cursorPos - cursorWidth / 2, halfHeight - halfHeight * 0.4);
      ctx.lineTo(cursorPos - cursorWidth / 2, halfHeight + halfHeight * 0.4);
      ctx.stroke();
      ctx.fill();

      const hoverPos = this.tl.windowHoverPos(cursorWidth) - cursorWidth / 2;
      ctx.strokeStyle = theme.accent;
      ctx.beginPath();
      ctx.moveTo(cursorPos + hoverPos, halfHeight + halfHeight * 0.4);
      ctx.lineTo(cursorPos + hoverPos, halfHeight - halfHeight * 0.4);
      ctx.stroke();

      ctx.font = monoFont(12);
      ctx.textAlign = "center";
      ctx.fillStyle = theme.accent;
      ctx.fillText(
        this.formatDuration(((tickDuration / 1000) * cursorWidth) / tickWidth),
        cursorPos,
        halfHeight - halfHeight * 0.6,
      );
    },
  },
});
</script>
