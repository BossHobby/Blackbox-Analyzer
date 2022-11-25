<template>
  <main>
    <div ref="canvasContainer" class="canvas-container">
      <canvas
        @mousedown="mousedown"
        @mousemove="mousemove"
        @mouseup="mouseup"
        @wheel="wheel"
        ref="canvas"
      />
    </div>
  </main>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useBlackboxStore } from "@/stores/blackbox";

enum BlackboxFields {
  LOOP,
  TIME,
  PID_P_TERM,
  PID_I_TERM,
  PID_D_TERM,
  RX,
  SETPOINT,
  ACCEL_RAW,
  ACCEL_FILTER,
  GYRO_RAW,
  GYRO_FILTER,
  MOTOR,
  CPU_LOAD,
}

function transformGyro(val: number) {
  return (val / 1000) * (180 / Math.PI);
}

export default defineComponent({
  name: "HomeView",
  setup() {
    return {
      bb: useBlackboxStore(),
    };
  },
  data() {
    return {
      ctx: null as unknown as CanvasRenderingContext2D,
      colors: ["#FFBE0B", "#FF006E", "#8338Ec", "#3A86FF", "#FB5607"],
      zoom: 100,
      offset: 0,
      drag: false,
    };
  },
  computed: {
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
    canvasContainer() {
      return this.$refs.canvasContainer as HTMLElement;
    },
    windowSize() {
      return this.canvas.width * this.zoom * 0.1;
    },
  },
  methods: {
    mousedown(e: MouseEvent) {
      this.drag = true;
    },
    mousemove(e: MouseEvent) {
      if (!this.drag) {
        return;
      }

      const delta = e.movementX / this.canvas.width;
      this.offset = Math.min(
        Math.max(this.offset - delta * this.windowSize, 0),
        this.bb.entries.length - this.windowSize
      );
    },
    mouseup(e: MouseEvent) {
      this.drag = false;
    },
    wheel(e: WheelEvent) {
      this.zoom = Math.min(
        Math.max(this.zoom + this.zoom * (e.deltaY / 500), 1),
        100
      );
    },
    draw() {
      this.ctx.fillStyle = "#333";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      const halfHeight = this.canvas.height / 2;

      let colorIndex = 0;
      const fields = [BlackboxFields.GYRO_RAW, BlackboxFields.GYRO_FILTER];
      for (const field of fields) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, halfHeight);
        for (const entry of this.bb.entries.slice(
          this.offset,
          this.offset + this.windowSize
        )) {
          const loop = entry[BlackboxFields.LOOP];
          const gyro = entry[field];
          const val = transformGyro(gyro[1]) / 1000;
          this.ctx.lineTo(
            (loop - this.offset) / (this.zoom * 0.1),
            val * halfHeight + halfHeight
          );
        }
        this.ctx.strokeStyle = this.colors[colorIndex++];
        this.ctx.stroke();
      }

      window.requestAnimationFrame(() => this.draw());
    },
  },
  mounted() {
    this.canvas.width = this.canvasContainer.clientWidth;
    this.canvas.height = this.canvasContainer.clientHeight;
    this.ctx = this.canvas.getContext("2d")!;
    this.bb.fetchBlackbox().then(() => this.draw());
  },
});
</script>

<style lang="scss">
.canvas-container {
  height: 99vh;
  width: 100%;
}
</style>
