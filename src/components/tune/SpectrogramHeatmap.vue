<template>
  <div class="h-[300px]" @mouseleave="hover = undefined">
    <CanvasComponent
      role="img"
      :aria-label="ariaLabel"
      @draw="draw"
      @mousemove="(e: MouseEvent) => (hover = [e.offsetX, e.offsetY])"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { monoFont, tooltip } from "@/analysis/render";
import { formatClock } from "@/log/types";
import { useChartTheme } from "@/ui/useChartTheme";
import { heatColor, heatRamp } from "@/ui/heatRamp";
import type { HeatmapData } from "@/analysis/spectrogram";

const props = defineProps<{
  data?: HeatmapData;
  dbRange: [number, number];
  cutoffs: { frequency: number; label: string }[];
  // Optional frequency tracks in Hz, one value per column (time mode only).
  tracks?: Float32Array[];
  loading?: boolean;
}>();

const PAD = { left: 52, right: 12, top: 8, bottom: 24 };

const theme = useChartTheme();
const hover = ref<[number, number]>();
const image = shallowRef<HTMLCanvasElement>();

const ariaLabel = computed(() =>
  props.data
    ? `Spectrogram by ${props.data.xKind}, 0 to ${props.data.freqMax.toFixed(0)} Hz`
    : "Spectrogram",
);

// The heatmap is rasterized once per data/theme/range change and scaled on
// every frame.
watch(
  () => [props.data, props.dbRange, theme.value] as const,
  () => {
    const data = props.data;
    if (!data?.columns) {
      image.value = undefined;
      return;
    }
    const ramp = heatRamp(theme.value);
    const [lo, hi] = props.dbRange;
    const canvas = document.createElement("canvas");
    canvas.width = data.columns;
    canvas.height = data.bins;
    const ctx = canvas.getContext("2d")!;
    const pixels = ctx.createImageData(data.columns, data.bins);
    for (let c = 0; c < data.columns; c++) {
      for (let b = 0; b < data.bins; b++) {
        const value = data.values[c * data.bins + b];
        if (!Number.isFinite(value)) continue;
        const [r, g, bl] = heatColor(ramp, (value - lo) / (hi - lo));
        const offset = ((data.bins - 1 - b) * data.columns + c) * 4;
        pixels.data[offset] = r;
        pixels.data[offset + 1] = g;
        pixels.data[offset + 2] = bl;
        pixels.data[offset + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    image.value = canvas;
  },
  { immediate: true },
);

function xLabel(data: HeatmapData, value: number) {
  return data.xKind == "throttle"
    ? `${(value * 100).toFixed(0)}%`
    : formatClock(value);
}

function draw(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas;
  const t = theme.value;
  ctx.clearRect(0, 0, width, height);
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const data = props.data;

  ctx.strokeStyle = t.grid;
  ctx.strokeRect(PAD.left - 0.5, PAD.top - 0.5, plotW + 1, plotH + 1);

  if (!data || !image.value) {
    ctx.fillStyle = t.text;
    ctx.font = monoFont(12);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      props.loading ? "Computing…" : "No data in range",
      PAD.left + plotW / 2,
      PAD.top + plotH / 2,
    );
    return;
  }

  ctx.imageSmoothingEnabled = data.xKind == "time";
  ctx.drawImage(image.value, PAD.left, PAD.top, plotW, plotH);

  const fy = (hz: number) => PAD.top + plotH * (1 - hz / data.freqMax);
  const xOfColumn = (c: number) =>
    PAD.left + ((c + 0.5) / data.columns) * plotW;

  // Frequency axis.
  ctx.font = monoFont(10);
  ctx.fillStyle = t.text;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const step = data.freqMax > 300 ? 100 : 50;
  for (let hz = 0; hz <= data.freqMax; hz += step) {
    const top = hz + step > data.freqMax;
    ctx.textBaseline = hz == 0 ? "bottom" : top ? "top" : "middle";
    ctx.fillText(top ? `${hz} Hz` : `${hz}`, PAD.left - 6, fy(hz));
  }

  ctx.textBaseline = "top";
  for (let i = 0; i <= 4; i++) {
    const value = data.xMin + ((data.xMax - data.xMin) * i) / 4;
    ctx.textAlign = i == 0 ? "left" : i == 4 ? "right" : "center";
    ctx.fillText(
      xLabel(data, value),
      PAD.left + (plotW * i) / 4,
      PAD.top + plotH + 6,
    );
  }

  // Dynamic notch centres as points: they hop between peaks too often to
  // read as lines.
  if (props.tracks?.length) {
    ctx.fillStyle = t.ink;
    ctx.globalAlpha = 0.7;
    for (const track of props.tracks) {
      for (let c = 0; c < track.length; c++) {
        const hz = track[c];
        if (hz > 0 && hz < data.freqMax) {
          ctx.fillRect(xOfColumn(c) - 1, fy(hz) - 1, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Filter cutoffs.
  ctx.font = monoFont(10);
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  for (const cutoff of props.cutoffs) {
    if (cutoff.frequency >= data.freqMax) continue;
    const py = Math.round(fy(cutoff.frequency)) + 0.5;
    ctx.strokeStyle = t.ink;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, py);
    ctx.lineTo(PAD.left + plotW, py);
    ctx.stroke();
    ctx.setLineDash([]);
    const text = cutoff.label;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = t.panel;
    ctx.fillRect(PAD.left + plotW - tw - 6, py - 14, tw + 4, 13);
    ctx.fillStyle = t.ink;
    ctx.fillText(text, PAD.left + plotW - 4, py - 2);
  }

  if (hover.value) {
    const [hx, hy] = hover.value;
    if (
      hx >= PAD.left &&
      hx <= PAD.left + plotW &&
      hy >= PAD.top &&
      hy <= PAD.top + plotH
    ) {
      const c = Math.min(
        Math.floor(((hx - PAD.left) / plotW) * data.columns),
        data.columns - 1,
      );
      const b = Math.min(
        Math.floor((1 - (hy - PAD.top) / plotH) * data.bins),
        data.bins - 1,
      );
      const db = data.values[c * data.bins + b];
      const x =
        data.xMin + ((c + 0.5) / data.columns) * (data.xMax - data.xMin);
      const hz = ((b + 0.5) / data.bins) * data.freqMax;
      ctx.strokeStyle = t.ink;
      ctx.strokeRect(Math.round(hx) - 4.5, Math.round(hy) - 4.5, 9, 9);
      tooltip(ctx, t, hx, Math.max(hy - 50, 4), width, [
        `${xLabel(data, x)} · ${hz.toFixed(0)} Hz`,
        Number.isFinite(db) ? `${db.toFixed(1)} dB` : "no samples",
      ]);
    }
  }
}
</script>
