<template>
  <div class="spectrum-graph p-4">
    <CanvasComponent ref="canvas" @mousemove="mousemove" @draw="draw" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import { BlackboxFieldIdentifier, useBlackboxStore } from "@/stores/blackbox";
import { useSpectrumStore } from "@/stores/spectrum";
import { useRenderStore } from "@/stores/render";

import CanvasComponent from "@/components/CanvasComponent.vue";
import { Analysis } from "@/analysis";
import { Color, Render } from "@/analysis/render";

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
      paddingLeft: 48,
      paddingBottom: 24,

      spectrumData: {
        min: Infinity,
        max: 0,
        range: 40,
        power: [] as any[],
      },

      loading: false,
      drag: false,
    };
  },
  computed: {
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
    sampleFrequency() {
      return 1000000 / (this.bb.rate * this.bb.looptime);
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
    spectrumFields() {
      return this.fields.map((field: any) => {
        return {
          id: new BlackboxFieldIdentifier(field.name, field.index),
          ...this.bb.fields[field.name],
          ...field,
        };
      });
    },
    specturmInput() {
      const inputSize = this.bb.entries.time.length / 2;
      const size = inputSize - (inputSize % 2 ? 1 : 0);

      return this.spectrumFields.map((field) => {
        return this.bb.entries[field.id.toString()].slice(0, size);
      });
    },
    specturmDataDecimated() {
      return this.spectrumData.power.map((power) =>
        Analysis.decimate(this.plotWidth, power)
      );
    },
    spectrumPath() {
      const height =
        this.spectrumData.min >= 0 ? this.plotHeight : this.halfHeight;

      return this.specturmDataDecimated.map((power) => {
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
    hoverValue() {
      if (!this.specturmDataDecimated || !this.specturmDataDecimated.length) {
        return [];
      }

      const tickWidth = this.plotWidth / this.specturmDataDecimated[0].length;
      const hoverIndex = (this.sp.hoverPos - this.paddingLeft) / tickWidth;
      const hoverIndexLower = Math.floor(hoverIndex);
      const hoverWeigthLower = hoverIndex - hoverIndexLower;
      const hoverIndexUpper = Math.ceil(hoverIndex);
      const hoverWeigthUpper = 1 - hoverWeigthLower;

      let maxLen = 0;
      return this.spectrumFields
        .map((field, fieldIndex) => {
          const valUpper =
            this.specturmDataDecimated[fieldIndex][hoverIndexUpper];
          const valLower =
            this.specturmDataDecimated[fieldIndex][hoverIndexLower];
          const val = valUpper * hoverWeigthUpper + valLower * hoverWeigthLower;
          const str = val.toFixed(2).toString();
          maxLen = Math.max(maxLen, str.length);
          return { field, str };
        })
        .map(({ field, str }) => {
          while (str.length < maxLen) str = " " + str;
          return field.title + " " + str;
        });
    },
  },
  watch: {
    async specturmInput(inputs: Float32Array[]) {
      this.updateSpectrumInput(inputs);
    },
  },
  methods: {
    mousemove(e: MouseEvent) {
      this.sp.hoverPos = Math.max(e.offsetX, this.paddingLeft);
    },
    async updateSpectrumInput(inputs: Float32Array[]) {
      const loadingStart = performance.now();
      this.loading = true;

      const data = {
        min: Infinity,
        max: 0,
        range: 0,
        power: [] as any[],
      };

      const promises = inputs.map((input) =>
        Analysis.fft(this.sampleFrequency, input)
      );

      for (const res of await Promise.all(promises)) {
        data.min = Math.min(data.min, res.min);
        data.max = Math.max(data.max, res.max);
        data.range = Math.max(data.range, res.range);
        data.power.push(res.power);
      }

      data.range = Math.floor(data.range / 10) + 1;
      data.range += data.range % 2;
      data.range *= 10;

      this.spectrumData = data;
      this.loading = false;

      console.log("specturmInput took", performance.now() - loadingStart, "ms");
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

      if (this.loading) {
        ctx.font = "32px Roboto Mono";
        ctx.fillStyle = Color.GREEN;
        ctx.fillText("loading...", this.plotWidth / 2, this.plotHeight / 2);
      } else {
        ctx.lineWidth = 1;
        for (const [index, path] of this.spectrumPath.entries()) {
          ctx.strokeStyle = this.render.colors[index];
          ctx.stroke(path);
        }

        const freqPerPixel = this.sampleFrequency / 2 / this.plotWidth;
        const hoverFreq = (
          (this.sp.hoverPos - this.paddingLeft) *
          freqPerPixel
        ).toFixed(2);

        const lines = [
          {
            text: "Frequency " + hoverFreq + " Hz",
            color: Color.GREEN as string,
          },
        ];
        for (const [index, val] of this.hoverValue.entries()) {
          lines.push({
            text: val + " dB",
            color: this.render.colors[index],
          });
        }
        Render.hoverText(
          ctx,
          this.sp.hoverPos,
          this.canvas.width,
          this.canvas.height,
          lines
        );
      }
    },
  },
  created() {
    this.updateSpectrumInput(this.specturmInput);
  },
});
</script>

<style lang="scss" scoped>
.spectrum-graph {
  height: 500px;
}
</style>
