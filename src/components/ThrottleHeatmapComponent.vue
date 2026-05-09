<template>
  <div class="throttle-heatmap box p-3">
    <div class="heatmap-title mb-3">
      <div>
        <h4 class="subtitle is-5 mb-1">Throttle Frequency Heatmap</h4>
        <p class="is-size-7 has-text-grey-light">
          {{ field?.title || "Select a field" }} power by throttle and frequency
        </p>
      </div>
      <span v-if="loading" class="tag is-warning">Computing...</span>
    </div>
    <div class="heatmap-controls mb-3">
      <div class="field is-narrow">
        <label class="label is-small">Field</label>
        <div class="select is-small">
          <select v-model="sp.heatmapField">
            <template
              v-for="(opt, index) in bb.fieldOptions"
              :key="'heatmap-field-group-' + index"
            >
              <optgroup :label="opt[0]?.groupTitle || 'Fields'">
                <option
                  v-for="o in opt.filter((o: any) => !o.group)"
                  :key="'heatmap-field-' + fieldIdToString(o.id)"
                  :value="o.id"
                >
                  {{ o.title }}
                </option>
              </optgroup>
            </template>
          </select>
        </div>
      </div>
      <div class="field is-narrow">
        <label class="label is-small">Max frequency</label>
        <div class="field has-addons">
          <p class="control">
            <input
              class="input is-small frequency-input"
              type="number"
              min="20"
              max="1000"
              step="10"
              :value="sp.heatmapMaxFrequency"
              @input="sp.setHeatmapMaxFrequency(Number(($event.target as HTMLInputElement).value))"
            />
          </p>
          <p class="control">
            <a class="button is-small is-static">Hz</a>
          </p>
        </div>
      </div>
      <div class="field is-narrow">
        <label class="label is-small">Throttle bins</label>
        <input
          class="input is-small bins-input"
          type="number"
          min="5"
          max="50"
          step="1"
          :value="sp.heatmapBinCount"
          @input="sp.setHeatmapBinCount(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>
    <CanvasComponent ref="canvas" @draw="draw" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { Analysis } from "@/analysis";
import { Color } from "@/analysis/render";
import {
  blackboxFieldIDToString,
  transformBlackbox,
  useBlackboxStore,
} from "@/stores/blackbox";
import { useSpectrumStore } from "@/stores/spectrum";

type HeatmapCell = {
  sum: number;
  count: number;
};

export default defineComponent({
  name: "ThrottleHeatmapComponent",
  components: {
    CanvasComponent,
  },
  setup() {
    return {
      bb: useBlackboxStore(),
      sp: useSpectrumStore(),
      fieldIdToString: blackboxFieldIDToString,
    };
  },
  data() {
    return {
      loading: false,
      generation: 0,
      heatmap: [] as number[][],
      minPower: 0,
      maxPower: 1,
      frequencyBins: 0,
      throttleBins: 0,
      paddingLeft: 48,
      paddingBottom: 28,
      paddingTop: 12,
    };
  },
  computed: {
    canvas() {
      return this.$refs.canvas as HTMLCanvasElement;
    },
    field() {
      return this.sp.heatmapFieldOption as any;
    },
    fieldKey() {
      return this.field?.id ? blackboxFieldIDToString(this.field.id) : "";
    },
    source() {
      return this.fieldKey ? this.bb.entries[this.fieldKey] : undefined;
    },
    throttle() {
      if (this.bb.entries.rx_3) {
        return this.bb.entries.rx_3;
      }
      if (this.bb.entries.setpoint_3) {
        return this.bb.entries.setpoint_3;
      }

      const motors = [0, 1, 2, 3]
        .map((index) => this.bb.entries[`motor_${index}`])
        .filter((entry): entry is Float32Array => entry != undefined);
      if (!motors.length) {
        return undefined;
      }

      const avg = new Float32Array(motors[0].length);
      for (let index = 0; index < avg.length; index++) {
        avg[index] = motors.reduce((sum, motor) => sum + motor[index], 0) / motors.length;
      }
      return avg;
    },
    maxFrequency() {
      return Math.min(this.sp.heatmapMaxFrequency, this.bb.sampleFrequency / 2);
    },
    filterCutoffs() {
      const profileFilter = this.bb.profile?.filter;
      if (!profileFilter || !this.fieldKey) {
        return [] as { label: string; frequency: number }[];
      }

      const filters = this.fieldKey.startsWith("pid_dterm")
        ? profileFilter.dterm
        : this.fieldKey.startsWith("gyro")
        ? profileFilter.gyro
        : [];
      return (filters || [])
        .map((filter: any, index: number) => ({
          label: index ? `LPF ${index + 1}` : "LPF 1",
          frequency: Number(filter.cutoff_freq || 0),
        }))
        .filter((filter: { frequency: number }) => filter.frequency > 0);
    },
  },
  watch: {
    source() {
      this.updateHeatmap();
    },
    throttle() {
      this.updateHeatmap();
    },
    "sp.heatmapMaxFrequency"() {
      this.updateHeatmap();
    },
    "sp.heatmapBinCount"() {
      this.updateHeatmap();
    },
  },
  methods: {
    throttlePercent(value: number) {
      const normalized = Math.abs(value) <= 1.5 ? value : value / 100;
      return Math.min(Math.max(normalized, 0), 1) * 100;
    },
    colorForPower(power: number) {
      const t = Math.min(
        Math.max((power - this.minPower) / Math.max(this.maxPower - this.minPower, 1), 0),
        1
      );
      const hue = 240 - 240 * t;
      const lightness = 18 + 44 * t;
      return `hsl(${hue}deg 90% ${lightness}%)`;
    },
    async updateHeatmap() {
      const source = this.source;
      const throttle = this.throttle;
      if (!source?.length || !throttle?.length || !this.field) {
        this.heatmap = [];
        return;
      }

      const generation = ++this.generation;
      this.loading = true;
      const sampleFrequency = this.bb.sampleFrequency;
      const windowSize = Math.min(512, 2 ** Math.floor(Math.log2(source.length)));
      const hop = Math.max(Math.floor(windowSize / 2), 1);
      const throttleBins = this.sp.heatmapBinCount;
      const maxFrequency = this.maxFrequency;
      const nyquist = sampleFrequency / 2;
      const cells = [] as HeatmapCell[][];
      let frequencyBins = 0;

      for (let start = this.bb.selectionStartIndex; start + windowSize <= this.bb.selectionEndIndex; start += hop) {
        const input = new Float32Array(windowSize);
        let throttleSum = 0;
        for (let offset = 0; offset < windowSize; offset++) {
          input[offset] = transformBlackbox(this.field, source[start + offset]);
          throttleSum += this.throttlePercent(throttle[start + offset]);
        }

        const throttleBin = Math.min(
          Math.floor((throttleSum / windowSize / 100) * throttleBins),
          throttleBins - 1
        );
        const fft = await Analysis.fft(sampleFrequency, input);
        if (generation != this.generation) {
          return;
        }

        frequencyBins = Math.max(
          Math.floor((maxFrequency / nyquist) * fft.power.length),
          1
        );
        cells[throttleBin] ||= [];
        for (let freq = 0; freq < frequencyBins; freq++) {
          cells[throttleBin][freq] ||= { sum: 0, count: 0 };
          cells[throttleBin][freq].sum += fft.power[freq];
          cells[throttleBin][freq].count++;
        }
      }

      const heatmap = [] as number[][];
      let minPower = Infinity;
      let maxPower = -Infinity;
      for (let throttleBin = 0; throttleBin < throttleBins; throttleBin++) {
        heatmap[throttleBin] = [];
        for (let freq = 0; freq < frequencyBins; freq++) {
          const cell = cells[throttleBin]?.[freq];
          const power = cell?.count ? cell.sum / cell.count : NaN;
          heatmap[throttleBin][freq] = power;
          if (Number.isFinite(power)) {
            minPower = Math.min(minPower, power);
            maxPower = Math.max(maxPower, power);
          }
        }
      }

      this.heatmap = heatmap;
      this.frequencyBins = frequencyBins;
      this.throttleBins = throttleBins;
      this.minPower = Number.isFinite(minPower) ? minPower : 0;
      this.maxPower = Number.isFinite(maxPower) ? maxPower : 1;
      this.loading = false;
    },
    draw(ctx: CanvasRenderingContext2D) {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const width = this.canvas.width - this.paddingLeft;
      const height = this.canvas.height - this.paddingBottom - this.paddingTop;
      const left = this.paddingLeft;
      const top = this.paddingTop;

      ctx.fillStyle = Color.GRAY_DARKER;
      ctx.fillRect(left, top, width, height);

      if (!this.heatmap.length || !this.frequencyBins || !this.throttleBins) {
        ctx.font = "16px Roboto Mono";
        ctx.textAlign = "center";
        ctx.fillStyle = Color.GRAY_LIGTHER;
        ctx.fillText("No heatmap data", left + width / 2, top + height / 2);
        return;
      }

      const cellWidth = width / this.throttleBins;
      const cellHeight = height / this.frequencyBins;
      for (let throttleBin = 0; throttleBin < this.throttleBins; throttleBin++) {
        for (let freq = 0; freq < this.frequencyBins; freq++) {
          const power = this.heatmap[throttleBin][freq];
          if (!Number.isFinite(power)) {
            continue;
          }
          ctx.fillStyle = this.colorForPower(power);
          ctx.fillRect(
            left + throttleBin * cellWidth,
            top + height - (freq + 1) * cellHeight,
            Math.ceil(cellWidth),
            Math.ceil(cellHeight)
          );
        }
      }

      ctx.strokeStyle = Color.GRAY_LIGTH;
      ctx.strokeRect(left, top, width, height);
      ctx.font = "12px Roboto Mono";
      ctx.fillStyle = Color.WHITE_OFF;
      ctx.textAlign = "center";
      for (let tick = 0; tick <= 4; tick++) {
        const x = left + (tick / 4) * width;
        ctx.fillText(`${tick * 25}%`, x, this.canvas.height - 8);
      }

      ctx.textAlign = "right";
      for (let tick = 0; tick <= 4; tick++) {
        const frequency = (tick / 4) * this.maxFrequency;
        const y = top + height - (tick / 4) * height;
        ctx.fillText(`${frequency.toFixed(0)}Hz`, left - 6, y + 4);
      }

      ctx.setLineDash([5, 5]);
      for (const cutoff of this.filterCutoffs) {
        if (cutoff.frequency > this.maxFrequency) {
          continue;
        }
        const y = top + height - (cutoff.frequency / this.maxFrequency) * height;
        ctx.strokeStyle = Color.GREEN;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + width, y);
        ctx.stroke();
        ctx.fillStyle = Color.GREEN;
        ctx.textAlign = "left";
        ctx.fillText(`${cutoff.label} ${cutoff.frequency}Hz`, left + 6, y - 4);
      }
      ctx.setLineDash([]);
    },
  },
  mounted() {
    this.updateHeatmap();
  },
});
</script>

<style lang="scss" scoped>
.throttle-heatmap {
  background: rgb(255 255 255 / 4%);
  height: 580px;
  margin: 0 1rem 1rem;
}

.heatmap-title {
  align-items: flex-start;
  display: flex;
  justify-content: space-between;
}

.heatmap-controls {
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.frequency-input,
.bins-input {
  width: 6rem;
}

.throttle-heatmap :deep(.canvas-container) {
  height: calc(100% - 7.25rem);
}
</style>
