<template>
  <div class="spectrum-graph p-4">
    <CanvasComponent ref="canvas" @mousemove="mousemove" @draw="draw" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

import { useBlackboxStore, blackboxFieldIDToString } from "@/stores/blackbox";
import { useSpectrumStore } from "@/stores/spectrum";
import { useRenderStore } from "@/stores/render";

import CanvasComponent from "@/components/CanvasComponent.vue";
import { Analysis } from "@/analysis";
import { Color, Render } from "@/analysis/render";

const MIN_PEAK_FREQUENCY = 80;
const PEAK_SMOOTH_HZ = 3;
const PEAK_BASELINE_HZ = 35;
const PEAK_GUARD_HZ = 8;
const MIN_PEAK_PROMINENCE_DB = 4;

function averageWindow(values: Float32Array, start: number, end: number) {
  let sum = 0;
  let count = 0;
  for (let index = start; index < end; index++) {
    const value = values[index];
    if (Number.isFinite(value)) {
      sum += value;
      count++;
    }
  }
  return count ? sum / count : undefined;
}

function smoothSpectrum(power: Float32Array, radius: number) {
  const smoothed = new Float32Array(power.length);
  for (let index = 0; index < power.length; index++) {
    const start = Math.max(index - radius, 0);
    const end = Math.min(index + radius + 1, power.length);
    smoothed[index] = averageWindow(power, start, end) ?? power[index];
  }
  return smoothed;
}

function detectPeak(power: Float32Array, sampleFrequency: number) {
  const nyquist = sampleFrequency / 2;
  if (!Number.isFinite(nyquist) || nyquist <= 0 || power.length < 3) {
    return undefined;
  }

  const hzPerBin = nyquist / (power.length - 1);
  if (!Number.isFinite(hzPerBin) || hzPerBin <= 0) {
    return undefined;
  }

  const startBin = Math.max(Math.ceil(MIN_PEAK_FREQUENCY / hzPerBin), 1);
  const smoothRadius = Math.max(Math.round(PEAK_SMOOTH_HZ / hzPerBin), 1);
  const guardBins = Math.max(
    Math.round(PEAK_GUARD_HZ / hzPerBin),
    smoothRadius + 1
  );
  const baselineBins = Math.max(
    Math.round(PEAK_BASELINE_HZ / hzPerBin),
    guardBins + 1
  );
  const smoothed = smoothSpectrum(power, smoothRadius);
  let best:
    | {
        index: number;
        prominence: number;
      }
    | undefined;

  for (let index = startBin; index < power.length - 1; index++) {
    const value = smoothed[index];
    if (
      !Number.isFinite(value) ||
      value < smoothed[index - 1] ||
      value < smoothed[index + 1]
    ) {
      continue;
    }

    const leftBaseline = averageWindow(
      smoothed,
      Math.max(startBin, index - baselineBins),
      Math.max(startBin, index - guardBins)
    );
    const rightBaseline = averageWindow(
      smoothed,
      Math.min(index + guardBins + 1, power.length),
      Math.min(index + baselineBins + 1, power.length)
    );
    const baselines = [leftBaseline, rightBaseline].filter(
      (baseline): baseline is number => baseline != undefined
    );
    if (!baselines.length) {
      continue;
    }

    const prominence = value - Math.max(...baselines);
    if (
      prominence >= MIN_PEAK_PROMINENCE_DB &&
      (!best || prominence > best.prominence)
    ) {
      best = { index, prominence };
    }
  }

  if (!best) {
    return undefined;
  }

  return {
    frequency: best.index * hzPerBin,
    power: power[best.index],
    prominence: best.prominence,
  };
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
    graphIndex: {
      type: Number,
      default: 0,
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
        power: [] as Float32Array[],
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
          ...this.bb.fields[field.name],
          ...field,
        };
      });
    },
    spectrumInput() {
      const end = this.bb.end > 0 ? this.bb.end : this.bb.entries.time.length;
      const inputSize = end - this.bb.start;
      const size = inputSize - (inputSize % 2 ? 1 : 0);

      if (size < 2) {
        return [];
      }

      return this.spectrumFields
        .map((field) => this.bb.entries[blackboxFieldIDToString(field.id)])
        .filter((entry): entry is Float32Array => entry != undefined)
        .map((entry) => entry.slice(this.bb.start, this.bb.start + size));
    },
    spectrumDataDecimated() {
      return this.spectrumData.power.map((power) =>
        Analysis.decimate(this.plotWidth, power)
      );
    },
    spectrumPath() {
      const height =
        this.spectrumData.min >= 0 ? this.plotHeight : this.halfHeight;

      return this.spectrumDataDecimated.map((power) => {
        const path = new Path2D();
        const data = power.map((p: number) => p / this.spectrumData.range);
        if (!data.length) {
          return path;
        }
        const tickWidth = this.plotWidth / data.length;

        path.moveTo(this.paddingLeft, height - height * data[0]);
        for (let i = 0; i < data.length; i++) {
          path.lineTo(
            this.paddingLeft + i * tickWidth,
            height - height * data[i]
          );
        }
        return path;
      });
    },
    hoverValue() {
      if (!this.spectrumDataDecimated || !this.spectrumDataDecimated.length) {
        return [];
      }

      const tickWidth = this.plotWidth / this.spectrumDataDecimated[0].length;
      if (!Number.isFinite(tickWidth) || tickWidth <= 0) {
        return [];
      }
      const hoverIndex = (this.sp.hoverPos - this.paddingLeft) / tickWidth;
      const hoverIndexLower = Math.floor(hoverIndex);
      const hoverWeigthLower = hoverIndex - hoverIndexLower;
      const hoverIndexUpper = Math.ceil(hoverIndex);
      const hoverWeigthUpper = 1 - hoverWeigthLower;

      let maxLen = 0;
      return this.spectrumFields
        .map((field, fieldIndex) => {
          const values = this.spectrumDataDecimated[fieldIndex];
          if (!values?.length) {
            return { field, str: "" };
          }
          const lower = Math.min(
            Math.max(hoverIndexLower, 0),
            values.length - 1
          );
          const upper = Math.min(
            Math.max(hoverIndexUpper, 0),
            values.length - 1
          );
          const valUpper = values[upper];
          const valLower = values[lower];
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
    peakLabels() {
      return this.spectrumData.power
        .map((power, fieldIndex) => {
          const peak = detectPeak(power, this.sampleFrequency);
          if (!peak) {
            return undefined;
          }
          return {
            fieldIndex,
            frequency: peak.frequency,
            power: peak.power,
          };
        })
        .filter(
          (
            peak
          ): peak is { fieldIndex: number; frequency: number; power: number } =>
            peak != undefined
        );
    },
  },
  watch: {
    async spectrumInput(inputs: Float32Array[]) {
      this.updateSpectrumInput(inputs);
    },
  },
  methods: {
    mousemove(e: MouseEvent) {
      this.sp.hoverPos = Math.max(e.offsetX, this.paddingLeft);
    },
    async updateSpectrumInput(inputs: Float32Array[]) {
      this.loading = true;

      if (!inputs.length) {
        this.spectrumData = {
          min: Infinity,
          max: -Infinity,
          range: 0,
          power: [],
        };
        this.loading = false;
        return;
      }

      const data = {
        min: Infinity,
        max: -Infinity,
        range: 0,
        power: [] as Float32Array[],
      };

      try {
        const promises = inputs.map((input) =>
          Analysis.fft(this.sampleFrequency, input)
        );

        for (const res of await Promise.all(promises)) {
          data.min = Math.min(data.min, res.min);
          data.max = Math.max(data.max, res.max);
          data.range = Math.max(data.range, res.range);
          data.power.push(res.power);
        }
      } catch (err) {
        console.warn("FFT failed", err);
        this.spectrumData = data;
        this.loading = false;
        return;
      }

      data.range = Math.floor(data.range / 10) + 1;
      data.range += data.range % 2;
      data.range *= 10;

      this.spectrumData = data;
      this.loading = false;
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
      if (!Number.isFinite(freqTicks) || freqTicks <= 0) {
        return;
      }
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

        ctx.font = "12px Roboto Mono";
        ctx.textAlign = "center";
        for (const peak of this.peakLabels) {
          const x =
            this.paddingLeft +
            (peak.frequency / (this.sampleFrequency / 2)) * this.plotWidth;
          if (
            !Number.isFinite(x) ||
            x < this.paddingLeft ||
            x > this.canvas.width
          ) {
            continue;
          }

          ctx.strokeStyle = this.render.colors[peak.fieldIndex];
          ctx.fillStyle = this.render.colors[peak.fieldIndex];
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, this.plotHeight);
          ctx.stroke();
          ctx.fillText(
            `${peak.frequency.toFixed(0)}Hz`,
            x,
            18 + peak.fieldIndex * 16
          );
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
    this.updateSpectrumInput(this.spectrumInput);
  },
});
</script>

<style lang="scss" scoped>
.spectrum-graph {
  height: 500px;
}
</style>
