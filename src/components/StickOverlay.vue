<template>
  <div class="py-2">
    <CanvasComponent ref="canvas" @draw="draw" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { monoFont } from "@/analysis/render";
import { useChartTheme } from "@/ui/useChartTheme";
import { useTimelineStore } from "@/stores/timeline";
import { transformBlackbox, useBlackboxStore } from "@/stores/blackbox";

export default defineComponent({
  name: "StickOverlay",
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
  computed: {
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
    rxValues() {
      const hoverIndex = this.tl.windowHoverIndex;
      const hoverIndexLower = Math.floor(hoverIndex);
      const hoverIndexUpper = Math.ceil(hoverIndex);
      const hoverWeigthUpper = hoverIndex - hoverIndexLower;
      const hoverWeigthLower = 1 - hoverWeigthUpper;

      const res = [];

      const field = this.bb.fields["rx"];
      if (!field) {
        return [0, 0, 0, 0];
      }
      for (let i = 0; i < 4; i++) {
        const values = this.bb.entries[`rx_${i}`];
        if (!values?.length) {
          res.push(0);
          continue;
        }
        const lower = Math.min(Math.max(hoverIndexLower, 0), values.length - 1);
        const upper = Math.min(Math.max(hoverIndexUpper, 0), values.length - 1);
        const valUpper = values[upper];
        const valLower = values[lower];
        const val = valUpper * hoverWeigthUpper + valLower * hoverWeigthLower;
        res.push(transformBlackbox(field, val));
      }
      return res;
    },
  },
  methods: {
    draw(ctx: CanvasRenderingContext2D) {
      if (!this.tl.ready) {
        return;
      }

      const theme = this.theme;
      const { width, height } = this.canvas;
      ctx.clearRect(0, 0, width, height);

      // Two square gimbals: yaw/throttle on the left, roll/pitch on the right.
      const gap = 12;
      const size = Math.floor(Math.min(height, (width - gap) / 2)) - 1;
      const half = size / 2;
      const boxes = [0.5, size + gap + 0.5];

      ctx.strokeStyle = theme.grid;
      ctx.fillStyle = theme.subtle;
      for (const x of boxes) {
        ctx.beginPath();
        ctx.rect(x, 0.5, size, size);
        ctx.fill();
        ctx.stroke();
      }

      const [roll, pitch, yaw, throttle] = this.rxValues;
      const label = (value: number) => (value * 100).toFixed(0);

      ctx.font = monoFont(11);
      ctx.fillStyle = theme.text;
      ctx.textAlign = "left";
      ctx.fillText(label(yaw), boxes[0] + 4, half + 4);
      ctx.fillText(label(roll), boxes[1] + 4, half + 4);
      ctx.textAlign = "center";
      ctx.fillText(label(throttle), boxes[0] + half, size - 4);
      ctx.fillText(label(pitch), boxes[1] + half, size - 4);

      ctx.strokeStyle = theme.ink;
      ctx.fillStyle = theme.danger;
      // Inset the travel by the dot radius so full deflection stays visible.
      const radius = 6;
      const travel = half - radius;
      const sticks = [
        [boxes[0] + half + yaw * travel, half + (1 - 2 * throttle) * travel],
        [boxes[1] + half + roll * travel, half - pitch * travel],
      ];
      for (const [x, y] of sticks) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    },
  },
});
</script>
