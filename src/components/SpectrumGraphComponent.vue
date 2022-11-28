<template>
  <div class="spectrum-graph p-4">
    <CanvasComponent ref="canvas" @mousemove="mousemove" @draw="draw" />
  </div>
  <div class="p-4">
    Window
    <input type="range" min="1" max="10" v-model="windowMul" step="1" />
    {{ windowMul }}
  </div>
  <div class="p-4">
    displayRangeX
    <input
      type="range"
      min="1"
      max="100"
      v-model="displayRangeX"
      step="0.001"
    />
    {{ displayRangeX }}
  </div>
  <div class="p-4">
    displayRangeY
    <input
      type="range"
      min="1"
      max="1000"
      v-model="displayRangeY"
      step="0.01"
    />
    {{ displayRangeY }}
  </div>
  <div class="p-4">
    frequency
    <input type="range" min="1" max="1000" v-model="frequency" step="1" />
    {{ frequency }}
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import { useBlackboxStore } from "@/stores/blackbox";
import { useSpectrumStore } from "@/stores/spectrum";
import { Color } from "@/stores/render";

import { rfft } from "kissfft-wasm";

import CanvasComponent from "@/components/CanvasComponent.vue";

function hamming(i: number, N: number) {
  return 0.54 - 0.46 * Math.cos((6.283185307179586 * i) / (N - 1));
}

function applyWindow(signal: number[], func: any) {
  var i,
    n = signal.length,
    args = [0, n];

  // pass rest of args
  for (i = 2; i < arguments.length; i++) {
    args[i] = arguments[i];
  }

  for (i = n - 1; i >= 0; i--) {
    args[0] = i;
    signal[i] *= func.apply(null, args);
  }

  return signal;
}

export default defineComponent({
  name: "SpectrumGraphComponent",
  components: {
    CanvasComponent,
  },
  props: {
    fields: {
      type: Array<Object>,
      default() {
        return [];
      },
    },
  },
  setup() {
    return {
      bb: useBlackboxStore(),
      sp: useSpectrumStore(),
    };
  },
  data() {
    return {
      graphPath: new Path2D(),
      windowMul: 3,
      hoverPos: 0,
      frequency: 10,
      displayRangeX: 1,
      displayRangeY: 1,
      sampleFrequency: 1000,
      paddingLeft: 48,
      paddingBottom: 24,
      drag: false,
    };
  },
  computed: {
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
    plotHeight() {
      return this.canvas.height - this.paddingBottom;
    },
    halfHeight() {
      return this.plotHeight / 2;
    },
    spectrumData() {
      const size =
        this.bb.entries.length - (this.bb.entries.length % 2 ? 1 : 0);

      const input = this.bb.entries
        .map((bb) => bb.gyro_filter[0])
        .slice(0, size);
      const windowedInput = applyWindow(input, hamming);

      let min = Infinity;
      let max = 0;
      let range = 0;

      const NC = 2.0 / (this.sampleFrequency * 1000 * size);
      const freq = rfft(windowedInput as any);
      const power = new Array(freq.length / 4);
      for (let i = 0; i < power.length; i++) {
        // +1 to skip the dc bin
        const re = freq[(i + 1) * 2];
        const im = freq[(i + 1) * 2 + 1];
        const real = Math.sqrt(re * re + im * im);

        let val = Math.pow(Math.abs(real), 2) * NC;
        if (val != 0) {
          val = 10 * Math.log10(val);
        }
        power[i] = val;
        min = Math.min(min, val);
        max = Math.max(max, val);
        range = Math.max(range, Math.abs(val));
      }

      range = Math.floor(range / 10) + 1;
      range += range % 2;
      range *= 10;

      return {
        min,
        max,
        range,
        power,
      };
    },
    spectrumPath() {
      const data = this.spectrumData.power.map(
        (p) => p / this.spectrumData.range
      );
      const tickWidth = (this.canvas.width - this.paddingLeft) / data.length;
      const path = new Path2D();

      console.log(this.spectrumData);

      path.moveTo(
        this.paddingLeft,
        this.halfHeight - this.halfHeight * data[0] * this.displayRangeY
      );
      for (let i = 0; i < data.length; i++) {
        path.lineTo(
          this.paddingLeft + i * tickWidth * this.displayRangeX,
          this.halfHeight - this.halfHeight * data[i] * this.displayRangeY
        );
      }
      return path;
    },
    movingAvgPath() {
      const data = this.spectrumData.power;
      const window = data.length / (this.windowMul * 64);
      const length = data.length + 1;

      const height = this.halfHeight;
      const tickWidth = (this.canvas.width - this.paddingLeft) / data.length;

      const path = new Path2D();
      path.moveTo(
        this.paddingLeft,
        height - height * data[0] * this.displayRangeY
      );

      let index = window - 1;
      while (++index < length) {
        const windowSlice = data.slice(index - window, index);
        const val =
          windowSlice.reduce((prev, curr) => prev + curr, 0) /
          window /
          this.spectrumData.range;
        path.lineTo(
          this.paddingLeft + index * tickWidth * this.displayRangeX,
          height - height * val * this.displayRangeY
        );
      }
      return path;
    },
    hoverValue() {
      const tickWidth =
        (this.canvas.width - this.paddingLeft) / this.spectrumData.power.length;
      const hoverIndex = (this.hoverPos - this.paddingLeft) / tickWidth;
      const hoverIndexLower = Math.floor(hoverIndex);
      const hoverWeigthLower = hoverIndex - hoverIndexLower;
      const hoverIndexUpper = Math.ceil(hoverIndex);
      const hoverWeigthUpper = 1 - hoverWeigthLower;

      const valUpper = this.spectrumData.power[hoverIndexUpper];
      const valLower = this.spectrumData.power[hoverIndexLower];
      const val = valUpper * hoverWeigthUpper + valLower * hoverWeigthLower;
      return val.toFixed(2).toString();
    },
  },
  methods: {
    mousemove(e: MouseEvent) {
      this.hoverPos = e.offsetX;
    },
    draw(ctx: CanvasRenderingContext2D) {
      if (!this.sp.ready) {
        return;
      }

      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      let divs = this.spectrumData.range / 10;

      ctx.strokeStyle = Color.GRAY_LIGTH;
      ctx.beginPath();
      for (let i = 0; i <= divs; i++) {
        ctx.moveTo(this.paddingLeft, (i * this.plotHeight) / divs);
        ctx.lineTo(this.canvas.width, (i * this.plotHeight) / divs);
      }
      ctx.stroke();

      ctx.font = "14px Roboto Mono";
      ctx.textAlign = "right";
      ctx.fillStyle = Color.GRAY_LIGTHER;
      for (let i = 0; i <= divs; i++) {
        ctx.fillText(
          (
            ((i - divs / 2) * this.spectrumData.range * -1) /
            (divs / 2)
          ).toString() + "dB",
          this.paddingLeft - 4,
          (i * this.plotHeight) / divs +
            (i > divs / 2 ? -3 : i == divs / 2 ? 3 : 12)
        );
      }

      const freqTicks = this.sampleFrequency / 2 / 50;
      ctx.textAlign = "center";
      for (let i = 1; i < freqTicks; i++) {
        ctx.fillText(
          (i * 50).toString() + "Hz",
          this.paddingLeft + i * (this.canvas.width / freqTicks),
          this.canvas.height
        );
      }

      ctx.strokeStyle = Color.GRAY_LIGTH;
      ctx.beginPath();
      for (let i = 0; i < freqTicks; i++) {
        ctx.moveTo(this.paddingLeft + i * (this.canvas.width / freqTicks), 0);
        ctx.lineTo(
          this.paddingLeft + i * (this.canvas.width / freqTicks),
          this.plotHeight
        );
      }
      ctx.stroke();

      //ctx.strokeStyle = Color.GREEN;
      //ctx.stroke(this.spectrumPath);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#FF006E";
      ctx.stroke(this.movingAvgPath);

      ctx.strokeStyle = Color.GREEN;
      ctx.beginPath();
      ctx.moveTo(this.hoverPos, 0);
      ctx.lineTo(this.hoverPos, this.canvas.height);
      ctx.stroke();

      ctx.font = "14px Roboto Mono";
      ctx.fillStyle = Color.GREEN;
      if (this.hoverPos > this.halfHeight) {
        ctx.textAlign = "right";
        ctx.fillText(this.hoverValue, this.hoverPos - 6, 20);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(this.hoverValue, this.hoverPos + 6, 20);
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.spectrum-graph {
  height: 500px;
}
</style>
