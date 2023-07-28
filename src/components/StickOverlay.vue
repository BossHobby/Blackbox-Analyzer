<template>
  <div class="stick-overlay">
    <CanvasComponent ref="canvas" @draw="draw" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { Color } from "@/analysis/render";
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
    };
  },
  computed: {
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
    rxValues() {
      const hoverIndex = this.tl.windowHoverIndex;
      const hoverIndexLower = Math.floor(hoverIndex);
      const hoverWeigthLower = hoverIndex - hoverIndexLower;
      const hoverIndexUpper = Math.ceil(hoverIndex);
      const hoverWeigthUpper = 1 - hoverWeigthLower;

      const res = [];

      const field = this.bb.fields["rx"];
      for (let i = 0; i < 4; i++) {
        const valUpper = this.bb.entries[`rx_${i}`][hoverIndexUpper];
        const valLower = this.bb.entries[`rx_${i}`][hoverIndexLower];
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

      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.strokeStyle = "hsla(0, 0%, 73%, 0.4)";
      ctx.fillStyle = "hsla(0, 0%, 3%, 0.4)";
      ctx.beginPath();
      ctx.rect(5, 5, 100, 100);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.rect(115, 5, 100, 100);
      ctx.fill();
      ctx.stroke();

      ctx.font = "14px Roboto Mono";
      ctx.textAlign = "center";
      ctx.fillStyle = Color.GRAY_LIGTHER;
      ctx.fillText((this.rxValues[0] * 100).toFixed(0), 125, 60);
      ctx.fillText((this.rxValues[1] * 100).toFixed(0), 165, 105);
      ctx.fillText((this.rxValues[2] * 100).toFixed(0), 20, 60);
      ctx.fillText((this.rxValues[3] * 100).toFixed(0), 55, 105);

      ctx.strokeStyle = Color.GRAY;
      ctx.fillStyle = Color.RED;
      ctx.beginPath();
      ctx.arc(
        55 + this.rxValues[2] * 50,
        105 - this.rxValues[3] * 100,
        7.5,
        0,
        2 * Math.PI
      );
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(
        165 + this.rxValues[0] * 50,
        55 - this.rxValues[1] * 50,
        7.5,
        0,
        2 * Math.PI
      );
      ctx.fill();
      ctx.stroke();
    },
  },
});
</script>

<style lang="scss" scoped>
.stick-overlay {
  position: fixed;
  right: 10px;
  top: 70px;
  height: 110px;
  width: 220px;
}
</style>
