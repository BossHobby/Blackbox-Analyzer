<template>
  <section class="min-w-0">
    <header class="mb-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <ul
        v-if="series.length > 1"
        class="flex flex-wrap gap-x-3 text-xs text-muted"
        aria-label="Legend"
      >
        <li
          v-for="(item, index) in series"
          :key="item.column"
          class="flex items-center gap-1.5"
        >
          <span
            class="h-0.5 w-3 rounded-full"
            :style="{ background: seriesColor(theme, item.color ?? index) }"
            aria-hidden="true"
          />{{ item.label }}
        </li>
      </ul>
      <span v-if="readout" class="ml-auto font-mono text-xs tabular-nums">
        {{ readout }}
      </span>
    </header>
    <div
      class="cursor-crosshair"
      :style="{ height: `${height}px` }"
      @mouseleave="emit('update:hover', undefined)"
    >
      <CanvasComponent
        role="img"
        :aria-label="title"
        @draw="draw"
        @mousemove="mousemove"
        @click="click"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { monoFont } from "@/analysis/render";
import {
  formatBlackboxValue,
  formatClock,
  transformBlackbox,
  unitBlackbox,
  useBlackboxStore,
} from "@/stores/blackbox";
import { seriesColor, useChartTheme } from "@/ui/useChartTheme";
import type { NavSeries } from "./types";

const props = withDefaults(
  defineProps<{
    title: string;
    series: NavSeries[];
    // Bitfield column drawn as one lane per named bit under the plot.
    flags?: { column: string; names: string[] };
    range: [number, number];
    hover?: number;
    cursor: number;
    // Frame ranges shaded in the background, e.g. RTH active.
    bands?: [number, number][];
    yRange?: [number, number];
    axis?: boolean;
    height?: number;
  }>(),
  {
    flags: undefined,
    hover: undefined,
    bands: undefined,
    yRange: undefined,
    height: 120,
  },
);
const emit = defineEmits<{
  "update:hover": [index: number | undefined];
  select: [index: number];
}>();

// Wide enough for the longest flag lane name, so stacked plots align.
const PAD = { left: 92, right: 8, top: 6 };
const LANE = 12;

const bb = useBlackboxStore();
const theme = useChartTheme();

const flagRows = computed(() => props.flags?.names.length ?? 0);
const bottom = computed(() => (props.axis ? 18 : 4) + flagRows.value * LANE);

const readout = computed(() => {
  const index = props.hover ?? props.cursor;
  const parts = props.series.map((item) => {
    const column = bb.entries[item.column];
    if (!column?.length) return "";
    const raw =
      column[Math.min(Math.max(Math.round(index), 0), column.length - 1)];
    const unit = unitBlackbox(item.def);
    const value = `${formatBlackboxValue(item.def, raw)}${unit ? " " + unit : ""}`;
    return props.series.length > 1 ? `${item.label} ${value}` : value;
  });
  return parts.filter(Boolean).join(" · ");
});

// Per-pixel min/max envelopes, recomputed only when the width or range moves.
let cache:
  | {
      key: string;
      envelopes: { min: Float32Array; max: Float32Array }[];
      lo: number;
      hi: number;
    }
  | undefined;

function envelopes(width: number) {
  const [start, end] = props.range;
  const key = `${width}:${start}:${end}:${props.series.map((s) => s.column).join()}`;
  if (cache?.key == key) return cache;

  const span = Math.max(end - start, 1);
  let lo = Infinity;
  let hi = -Infinity;
  const result = props.series.map((item) => {
    const min = new Float32Array(width).fill(NaN);
    const max = new Float32Array(width).fill(NaN);
    const column = bb.entries[item.column];
    if (!column) return { min, max };
    for (let i = start; i < end; i++) {
      const px = Math.floor(((i - start) / span) * width);
      const v = transformBlackbox(item.def, column[i]);
      if (!(v >= min[px])) min[px] = v;
      if (!(v <= max[px])) max[px] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return { min, max };
  });
  cache = { key, envelopes: result, lo, hi };
  return cache;
}

// Frame runs where each flag bit is set, cached per range.
let flagCache: { key: string; runs: [number, number][][] } | undefined;

function flagRuns() {
  const [start, end] = props.range;
  const flags = props.flags!;
  const key = `${start}:${end}:${flags.column}`;
  if (flagCache?.key == key) return flagCache.runs;
  const column = bb.entries[flags.column];
  const runs = flags.names.map(() => [] as [number, number][]);
  if (column) {
    const open = flags.names.map(() => -1);
    for (let i = start; i <= end; i++) {
      const value = i < end ? column[i] : 0;
      for (let bit = 0; bit < runs.length; bit++) {
        const set = (value & (1 << bit)) != 0;
        if (set && open[bit] < 0) open[bit] = i;
        if (!set && open[bit] >= 0) {
          runs[bit].push([open[bit], i]);
          open[bit] = -1;
        }
      }
    }
  }
  flagCache = { key, runs };
  return runs;
}

function niceStep(span: number) {
  const raw = span / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
}

function indexAt(x: number, width: number) {
  const [start, end] = props.range;
  const fraction = (x - PAD.left) / (width - PAD.left - PAD.right);
  return start + Math.min(Math.max(fraction, 0), 1) * (end - start);
}

function draw(ctx: CanvasRenderingContext2D) {
  const { width, height } = ctx.canvas;
  const t = theme.value;
  ctx.clearRect(0, 0, width, height);
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = height - PAD.top - bottom.value;
  const [start, end] = props.range;
  const span = Math.max(end - start, 1);
  const xOf = (index: number) => PAD.left + ((index - start) / span) * plotW;

  for (const [from, to] of props.bands ?? []) {
    ctx.fillStyle = t.bands[1];
    ctx.fillRect(xOf(from), PAD.top, Math.max(xOf(to) - xOf(from), 1), plotH);
  }

  const env = envelopes(Math.round(plotW));
  let [lo, hi] = props.yRange ?? [env.lo, env.hi];
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) [lo, hi] = [0, 1];
  if (hi - lo < 1e-6) [lo, hi] = [lo - 1, hi + 1];
  if (!props.yRange) {
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
  }
  const yOf = (v: number) => PAD.top + plotH * (1 - (v - lo) / (hi - lo));

  // Grid and y ticks.
  const step = niceStep(hi - lo);
  ctx.font = monoFont(10);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = t.grid;
  ctx.lineWidth = 1;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    const py = Math.round(yOf(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, py);
    ctx.lineTo(PAD.left + plotW, py);
    ctx.stroke();
    ctx.fillStyle = t.text;
    ctx.fillText(`${+v.toFixed(6)}`, PAD.left - 6, py);
  }

  props.series.forEach((item, s) => {
    const { min, max } = env.envelopes[s];
    ctx.strokeStyle = seriesColor(t, item.color ?? s);
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    let pen = false;
    let last = NaN;
    for (let px = 0; px < min.length; px++) {
      if (Number.isNaN(min[px])) {
        pen = false;
        continue;
      }
      const mid = (min[px] + max[px]) / 2;
      const wrapped =
        item.wrap != undefined &&
        (max[px] - min[px] > item.wrap / 2 ||
          Math.abs(mid - last) > item.wrap / 2);
      const x = PAD.left + px + 0.5;
      if (wrapped) {
        // Draw the two sides of the wrap as separate points.
        ctx.moveTo(x, yOf(min[px]));
        ctx.lineTo(x, yOf(min[px]));
        ctx.moveTo(x, yOf(max[px]));
        ctx.lineTo(x, yOf(max[px]));
        pen = false;
      } else if (!pen) {
        ctx.moveTo(x, yOf(max[px]));
        ctx.lineTo(x, yOf(min[px]));
        pen = true;
      } else {
        ctx.lineTo(x, yOf(max[px]));
        ctx.lineTo(x, yOf(min[px]));
      }
      last = mid;
    }
    ctx.stroke();
  });
  ctx.lineWidth = 1;

  // Bitfield lanes.
  if (props.flags) {
    const top = PAD.top + plotH + 4;
    ctx.font = monoFont(9.5);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const runs = flagRuns();
    props.flags.names.forEach((name, bit) => {
      const y = top + bit * LANE;
      ctx.fillStyle = t.text;
      ctx.fillText(name, PAD.left - 6, y + LANE / 2);
      ctx.fillStyle = t.warning;
      for (const [from, to] of runs[bit]) {
        ctx.fillRect(
          xOf(from),
          y + 2,
          Math.max(xOf(to) - xOf(from), 1),
          LANE - 4,
        );
      }
    });
  }

  if (props.axis) {
    ctx.font = monoFont(10);
    ctx.fillStyle = t.text;
    ctx.textBaseline = "bottom";
    for (let i = 0; i <= 4; i++) {
      const index = start + (span * i) / 4;
      ctx.textAlign = i == 0 ? "left" : i == 4 ? "right" : "center";
      ctx.fillText(
        formatClock(bb.entriesPerMS ? index / bb.entriesPerMS : 0),
        xOf(index),
        height - 2,
      );
    }
  }

  // Shared cursor (solid) and hover (accent).
  const cx = Math.round(xOf(props.cursor)) + 0.5;
  ctx.strokeStyle = t.ink;
  ctx.beginPath();
  ctx.moveTo(cx, PAD.top);
  ctx.lineTo(cx, height - (props.axis ? 18 : 0));
  ctx.stroke();
  if (props.hover != undefined) {
    const hx = Math.round(xOf(props.hover)) + 0.5;
    ctx.strokeStyle = t.accent;
    ctx.beginPath();
    ctx.moveTo(hx, PAD.top);
    ctx.lineTo(hx, height - (props.axis ? 18 : 0));
    ctx.stroke();
  }
}

function mousemove(e: MouseEvent) {
  const canvas = e.target as HTMLCanvasElement;
  if (e.offsetX < PAD.left) {
    emit("update:hover", undefined);
    return;
  }
  emit("update:hover", indexAt(e.offsetX, canvas.width));
}

function click(e: MouseEvent) {
  const canvas = e.target as HTMLCanvasElement;
  if (e.offsetX >= PAD.left) {
    emit("select", indexAt(e.offsetX, canvas.width));
  }
}
</script>
