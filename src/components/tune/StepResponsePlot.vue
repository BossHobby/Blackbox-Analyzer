<template>
  <div class="flex min-w-0 flex-col">
    <div class="h-[240px]" @mouseleave="hover = undefined">
      <CanvasComponent
        role="img"
        :aria-label="ariaLabel"
        @draw="draw"
        @mousemove="(e: MouseEvent) => (hover = e.offsetX)"
      />
    </div>
    <dl
      v-if="metrics"
      class="mt-2 grid grid-cols-4 gap-2 text-xs text-muted tabular-nums"
    >
      <div>
        <dt>Delay</dt>
        <dd class="text-sm text-ink">{{ metrics.delay.toFixed(0) }} ms</dd>
      </div>
      <div>
        <dt>Rise</dt>
        <dd class="text-sm text-ink">{{ metrics.rise.toFixed(0) }} ms</dd>
      </div>
      <div>
        <dt>Overshoot</dt>
        <dd class="text-sm text-ink">{{ metrics.overshoot.toFixed(0) }}%</dd>
      </div>
      <div>
        <dt>Steady</dt>
        <dd class="text-sm text-ink">{{ metrics.steady.toFixed(2) }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { monoFont, tooltip } from "@/analysis/render";
import type { StepResponse } from "@/analysis";
import { useChartTheme } from "@/ui/useChartTheme";

const props = defineProps<{
  response?: StepResponse;
  sampleFrequency: number;
  loading?: boolean;
}>();

const PAD = { left: 40, right: 12, top: 12, bottom: 24 };
// Steady state is read where the Rust estimator reads it: 200-500 ms.
const STEADY_FROM_MS = 200;

const theme = useChartTheme();
const hover = ref<number>();

const msPerSample = computed(() => 1000 / props.sampleFrequency);

interface StepMetrics {
  steady: number;
  delay: number;
  rise: number;
  overshoot: number;
}

const metrics = computed<StepMetrics | undefined>(() => {
  const mean = props.response?.mean;
  if (!mean?.length) {
    return undefined;
  }
  const from = Math.floor(STEADY_FROM_MS / msPerSample.value);
  let steady = 0;
  for (let i = from; i < mean.length; i++) steady += mean[i];
  steady /= Math.max(mean.length - from, 1);

  const firstAbove = (level: number) => {
    const index = mean.findIndex((v) => v >= level * steady);
    return index < 0 ? mean.length - 1 : index;
  };
  const peak = Math.max(...mean);
  return {
    steady,
    delay: firstAbove(0.5) * msPerSample.value,
    rise: (firstAbove(0.9) - firstAbove(0.1)) * msPerSample.value,
    overshoot: Math.max((peak / steady - 1) * 100, 0),
  };
});

const ariaLabel = computed(() => {
  const m = metrics.value;
  return m
    ? `Step response: delay ${m.delay.toFixed(0)} ms, rise ${m.rise.toFixed(0)} ms, overshoot ${m.overshoot.toFixed(0)}%`
    : "Step response";
});

function draw(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas;
  const t = theme.value;
  ctx.clearRect(0, 0, width, height);

  const response = props.response;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const length = response?.mean.length || 500 / msPerSample.value;
  let yMax = 1.5;
  if (response?.high.length) {
    yMax = Math.max(yMax, Math.ceil(Math.max(...response.high) * 4) / 4);
  }
  const x = (i: number) => PAD.left + (i / Math.max(length - 1, 1)) * plotW;
  const y = (v: number) => PAD.top + plotH * (1 - v / yMax);

  ctx.font = monoFont(10);
  ctx.fillStyle = t.text;
  ctx.strokeStyle = t.grid;
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let v = 0; v <= yMax + 1e-6; v += 0.5) {
    const py = Math.round(y(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, py);
    ctx.lineTo(width - PAD.right, py);
    ctx.stroke();
    ctx.fillText(v.toFixed(1), PAD.left - 6, py);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let ms = 0; ms <= 500; ms += 100) {
    ctx.textAlign = ms == 0 ? "left" : ms == 500 ? "right" : "center";
    ctx.fillText(
      ms == 500 ? "500 ms" : `${ms}`,
      x(ms / msPerSample.value),
      height - PAD.bottom + 6,
    );
  }

  // Target level.
  ctx.strokeStyle = t.text;
  ctx.beginPath();
  ctx.moveTo(PAD.left, Math.round(y(1)) + 0.5);
  ctx.lineTo(width - PAD.right, Math.round(y(1)) + 0.5);
  ctx.stroke();

  if (!response?.mean.length) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = monoFont(12);
    ctx.fillStyle = t.text;
    ctx.fillText(
      props.loading ? "Computing…" : "Not enough stick input in range",
      PAD.left + plotW / 2,
      PAD.top + plotH / 2,
    );
    return;
  }

  const { mean, low, high } = response;
  const band = new Path2D();
  for (let i = 0; i < high.length; i++) {
    if (i == 0) band.moveTo(x(i), y(high[i]));
    else band.lineTo(x(i), y(high[i]));
  }
  for (let i = low.length - 1; i >= 0; i--) band.lineTo(x(i), y(low[i]));
  band.closePath();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = t.series[0];
  ctx.fill(band);
  ctx.globalAlpha = 1;

  ctx.beginPath();
  for (let i = 0; i < mean.length; i++) {
    if (i == 0) ctx.moveTo(x(i), y(mean[i]));
    else ctx.lineTo(x(i), y(mean[i]));
  }
  ctx.strokeStyle = t.series[0];
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.lineWidth = 1;

  if (hover.value != undefined && hover.value >= PAD.left) {
    const i = Math.min(
      Math.max(
        Math.round(((hover.value - PAD.left) / plotW) * (mean.length - 1)),
        0,
      ),
      mean.length - 1,
    );
    const px = Math.round(x(i)) + 0.5;
    ctx.strokeStyle = t.ink;
    ctx.beginPath();
    ctx.moveTo(px, PAD.top);
    ctx.lineTo(px, PAD.top + plotH);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x(i), y(mean[i]), 4, 0, Math.PI * 2);
    ctx.fillStyle = t.series[0];
    ctx.fill();
    ctx.strokeStyle = t.panel;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;
    tooltip(ctx, t, px, PAD.top + 4, width, [
      `${(i * msPerSample.value).toFixed(0)} ms`,
      `Response ${mean[i].toFixed(2)}`,
      `Spread ${low[i].toFixed(2)}–${high[i].toFixed(2)}`,
    ]);
  }
}
</script>
