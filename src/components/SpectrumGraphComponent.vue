<template>
  <div class="spectrum-graph p-4">
    <CanvasComponent ref="canvas" @mousemove="mousemove" @draw="draw" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import { movingAvg, useBlackboxStore } from "@/stores/blackbox";
import { useSpectrumStore } from "@/stores/spectrum";
import { Color, useRenderStore } from "@/stores/render";

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
      render: useRenderStore(),
      bb: useBlackboxStore(),
      sp: useSpectrumStore(),
    };
  },
  data() {
    return {
      graphPath: new Path2D(),
      paddingLeft: 48,
      paddingBottom: 24,
      drag: false,
    };
  },
  computed: {
    sampleFrequency() {
      return this.bb.rate * this.bb.looptime;
    },
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
    plotWidth() {
      return this.canvas.width - this.paddingLeft;
    },
    plotHeight() {
      return this.canvas.height - this.paddingBottom;
    },
    halfHeight() {
      return this.plotHeight / 2;
    },
    spectrumData() {
      const res = {
        min: Infinity,
        max: 0,
        range: 0,
        power: [] as any[],
      };

      for (const field of this.fields as any[]) {
        const size =
          this.bb.entries.length - (this.bb.entries.length % 2 ? 1 : 0);
        const input = this.bb.entries
          .map((entry) => {
            let val = entry[field.name];
            if (field.index != undefined) {
              val = val[field.index];
            }
            return val;
          })
          .slice(0, size);

        const windowedInput = applyWindow(input, hamming);

        const NC = 2.0 / (this.sampleFrequency * 1000 * size);
        const freq = rfft(windowedInput as any);
        const power = new Array(freq.length / 4);
        for (let i = 0; i < power.length; i++) {
          const re = freq[i * 2];
          const im = freq[i * 2 + 1];
          const real = Math.sqrt(re * re + im * im);

          let val = Math.pow(Math.abs(real), 2) * NC;
          if (val != 0) {
            val = 10 * Math.log10(val);
          }
          power[i] = val;
          res.min = Math.min(res.min, val);
          res.max = Math.max(res.max, val);
          res.range = Math.max(res.range, Math.abs(val));
        }
        res.power.push(power);
      }

      res.range = Math.floor(res.range / 10) + 1;
      res.range += res.range % 2;
      res.range *= 10;

      return res;
    },
    spectrumPath() {
      const height =
        this.spectrumData.min >= 0 ? this.plotHeight : this.halfHeight;

      return this.spectrumData.power.map((power) => {
        const path = new Path2D();
        const data = power.map((p: number) => p / this.spectrumData.range);
        const tickWidth = this.plotWidth / data.length;

        path.moveTo(
          this.paddingLeft,
          height - height * data[0] * this.sp.displayRangeY
        );
        for (let i = 0; i < data.length; i++) {
          path.lineTo(
            this.paddingLeft + i * tickWidth * this.sp.displayRangeX,
            height - height * data[i] * this.sp.displayRangeY
          );
        }
        return path;
      });
    },
    movingAvgData() {
      return this.spectrumData.power.map((input) => {
        const window = Math.round(input.length / (this.sp.smoothing * 10));
        return movingAvg(input, window);
      });
    },
    movingAvgPath() {
      const height =
        this.spectrumData.min >= 0 ? this.plotHeight : this.halfHeight;

      return this.movingAvgData.map((avg) => {
        const data = avg.map((d) => d / this.spectrumData.range);
        const tickWidth = this.plotWidth / data.length;

        const path = new Path2D();
        path.moveTo(
          this.paddingLeft,
          height - height * data[0] * this.sp.displayRangeY
        );
        for (let i = 0; i < data.length; i++) {
          path.lineTo(
            this.paddingLeft + i * tickWidth * this.sp.displayRangeX,
            height - height * data[i] * this.sp.displayRangeY
          );
        }
        return path;
      });
    },
    hoverValue() {
      const tickWidth = this.plotWidth / this.movingAvgData[0].length;
      const hoverIndex = (this.sp.hoverPos - this.paddingLeft) / tickWidth;
      const hoverIndexLower = Math.floor(hoverIndex);
      const hoverWeigthLower = hoverIndex - hoverIndexLower;
      const hoverIndexUpper = Math.ceil(hoverIndex);
      const hoverWeigthUpper = 1 - hoverWeigthLower;

      return this.movingAvgData.map((data) => {
        const valUpper = data[hoverIndexUpper];
        const valLower = data[hoverIndexLower];
        const val = valUpper * hoverWeigthUpper + valLower * hoverWeigthLower;
        return val.toFixed(2).toString();
      });
    },
  },
  methods: {
    mousemove(e: MouseEvent) {
      this.sp.hoverPos = Math.max(e.offsetX, this.paddingLeft);
    },
    draw(ctx: CanvasRenderingContext2D) {
      if (!this.sp.ready) {
        return;
      }

      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      let divs = Math.min(this.spectrumData.range / 10, 10);

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
          this.paddingLeft + i * (this.plotWidth / freqTicks),
          this.canvas.height
        );
      }

      ctx.strokeStyle = Color.GRAY_LIGTH;
      ctx.beginPath();
      for (let i = 0; i < freqTicks; i++) {
        ctx.moveTo(this.paddingLeft + i * (this.plotWidth / freqTicks), 0);
        ctx.lineTo(
          this.paddingLeft + i * (this.plotWidth / freqTicks),
          this.plotHeight
        );
      }
      ctx.stroke();

      //ctx.lineWidth = 0.5;
      //for (const path of this.spectrumPath) {
      //ctx.strokeStyle = Color.GREEN;
      //ctx.stroke(path);
      //}

      ctx.lineWidth = 2;
      for (const [index, path] of this.movingAvgPath.entries()) {
        ctx.strokeStyle = this.render.colors[index];
        ctx.stroke(path);
      }

      ctx.strokeStyle = Color.GREEN;
      ctx.beginPath();
      ctx.moveTo(this.sp.hoverPos, 0);
      ctx.lineTo(this.sp.hoverPos, this.canvas.height);
      ctx.stroke();

      ctx.font = "14px Roboto Mono";
      ctx.fillStyle = Color.GREEN;
      const freqPerPixel = this.sampleFrequency / 2 / this.plotWidth;
      const hoverFreq = (
        (this.sp.hoverPos - this.paddingLeft) *
        freqPerPixel
      ).toFixed(2);
      if (this.sp.hoverPos > this.canvas.width / 2) {
        ctx.textAlign = "right";
        ctx.fillText(hoverFreq + " Hz", this.sp.hoverPos - 6, 20);
        for (const [index, val] of this.hoverValue.entries()) {
          ctx.fillText(val + " dB", this.sp.hoverPos - 6, index * 20 + 40);
        }
      } else {
        ctx.textAlign = "left";
        ctx.fillText(hoverFreq + " Hz", this.sp.hoverPos + 6, 20);
        for (const [index, val] of this.hoverValue.entries()) {
          ctx.fillText(val + " dB", this.sp.hoverPos + 6, index * 20 + 40);
        }
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
