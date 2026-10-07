<template>
  <div
    class="h-[148px] cursor-pointer"
    role="img"
    :aria-label="ariaLabel"
    @mouseleave="hover = undefined"
  >
    <CanvasComponent
      ref="canvas"
      @draw="draw"
      @mousemove="(e: MouseEvent) => (hover = e.offsetX)"
      @click="click"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { formatClock, useBlackboxStore } from "@/stores/blackbox";
import { useTimelineStore } from "@/stores/timeline";
import { monoFont, tooltip } from "@/analysis/render";
import { useChartTheme } from "@/ui/useChartTheme";
import { useLogPosition } from "@/ui/useJump";
import type { LogEvent } from "@/log/summary";
import { navigationStates } from "@/log/profile";

const GUTTER = 88;
const PAD_RIGHT = 8;
const EVENTS = { y: 4, h: 12 };
const THROTTLE = { y: 24, h: 72 };
const SATURATION = { y: 104, h: 14 };
const RTH = { y: 126, h: 16 };

const bb = useBlackboxStore();
const tl = useTimelineStore();
const theme = useChartTheme();
const position = useLogPosition();
const hover = ref<number>();

const strip = computed(() => bb.summary!.strip);
const nav = computed(() => navigationStates(bb.profile));
const rthLabels = computed(() => nav.value?.labels ?? ([] as string[]));
const ariaLabel = computed(() => {
  const throttle = bb.summary?.throttle;
  return throttle
    ? `Flight strip: mean throttle ${(throttle.mean * 100).toFixed(0)}%, ${bb.summary!.events.length} events`
    : "Flight strip";
});

function plotWidth(width: number) {
  return width - GUTTER - PAD_RIGHT;
}

function xOfIndex(index: number, width: number) {
  return GUTTER + (index / Math.max(bb.entryCount, 1)) * plotWidth(width);
}

function indexAt(x: number, width: number) {
  const fraction = (x - GUTTER) / plotWidth(width);
  return Math.min(Math.max(fraction, 0), 1) * Math.max(bb.entryCount - 1, 0);
}

function bucketAt(x: number, width: number) {
  const fraction = (x - GUTTER) / plotWidth(width);
  return Math.min(
    Math.max(Math.floor(fraction * strip.value.buckets), 0),
    strip.value.buckets - 1,
  );
}

function eventColor(event: LogEvent) {
  const t = theme.value;
  return event.severity == "critical"
    ? t.danger
    : event.severity == "warning"
      ? t.warning
      : t.accent;
}

function laneLabel(ctx: CanvasRenderingContext2D, text: string, y: number) {
  ctx.fillStyle = theme.value.text;
  ctx.font = monoFont(11);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 8, y);
}

function drawThrottle(ctx: CanvasRenderingContext2D, width: number) {
  const throttle = strip.value.throttle;
  if (!throttle) {
    return;
  }
  const t = theme.value;
  const step = plotWidth(width) / throttle.length;
  // Rovers log reverse as negative throttle.
  const low = (bb.summary!.throttle?.min ?? 0) < 0 ? -1 : 0;
  const y = (v: number) => THROTTLE.y + (THROTTLE.h * (1 - v)) / (1 - low);

  ctx.strokeStyle = t.grid;
  ctx.lineWidth = 1;
  for (const level of low ? [-1, 0, 1] : [0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(GUTTER, Math.round(y(level)) + 0.5);
    ctx.lineTo(width - PAD_RIGHT, Math.round(y(level)) + 0.5);
    ctx.stroke();
  }

  const line = new Path2D();
  for (let b = 0; b < throttle.length; b++) {
    const x = GUTTER + (b + 0.5) * step;
    if (b == 0) line.moveTo(x, y(throttle[b]));
    else line.lineTo(x, y(throttle[b]));
  }
  const area = new Path2D(line);
  area.lineTo(GUTTER + (throttle.length - 0.5) * step, y(0));
  area.lineTo(GUTTER + 0.5 * step, y(0));
  area.closePath();

  ctx.globalAlpha = 0.1;
  ctx.fillStyle = t.series[0];
  ctx.fill(area);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = t.series[0];
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke(line);
  ctx.lineWidth = 1;

  laneLabel(ctx, "Throttle", THROTTLE.y + THROTTLE.h / 2);
  ctx.fillStyle = t.text;
  ctx.font = monoFont(10);
  ctx.textAlign = "right";
  ctx.fillText("100%", GUTTER - 6, y(1));
  ctx.fillText(low ? "-100%" : "0%", GUTTER - 6, y(low));
}

function drawSaturation(ctx: CanvasRenderingContext2D, width: number) {
  const saturation = strip.value.saturation;
  if (!saturation) {
    return;
  }
  const step = plotWidth(width) / saturation.length;
  ctx.fillStyle = theme.value.warning;
  for (let b = 0; b < saturation.length; b++) {
    if (!saturation[b]) continue;
    // Any saturation in a bucket stays visible; full buckets read solid.
    ctx.globalAlpha = 0.25 + 0.75 * Math.min(saturation[b] * 4, 1);
    ctx.fillRect(
      GUTTER + b * step,
      SATURATION.y,
      Math.max(step, 1),
      SATURATION.h,
    );
  }
  ctx.globalAlpha = 1;
  laneLabel(ctx, "Saturation", SATURATION.y + SATURATION.h / 2);
}

function drawRth(ctx: CanvasRenderingContext2D, width: number) {
  const states = strip.value.rthState;
  if (!states) {
    return;
  }
  const t = theme.value;
  const step = plotWidth(width) / states.length;
  ctx.font = monoFont(10);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  let start = 0;
  for (let b = 1; b <= states.length; b++) {
    if (b < states.length && states[b] == states[start]) continue;
    const state = states[start];
    if (state) {
      const x = GUTTER + start * step;
      const w = Math.max((b - start) * step - 2, 1);
      const failed = !!nav.value?.failures.has(state);
      ctx.globalAlpha = failed ? 0.35 : 0.2;
      ctx.fillStyle = failed ? t.danger : t.series[5];
      ctx.fillRect(x, RTH.y, w, RTH.h);
      ctx.globalAlpha = 1;
      const label = rthLabels.value[state] ?? `${state}`;
      if (ctx.measureText(label).width + 8 < w) {
        ctx.fillStyle = t.ink;
        ctx.fillText(label, x + 4, RTH.y + RTH.h / 2);
      }
    }
    start = b;
  }
  laneLabel(ctx, nav.value?.name == "RTH" ? "RTH" : "Nav", RTH.y + RTH.h / 2);
}

function drawEvents(ctx: CanvasRenderingContext2D, width: number) {
  for (const event of bb.summary!.events) {
    const x0 = xOfIndex(event.start, width);
    const x1 = xOfIndex(event.end, width);
    ctx.fillStyle = eventColor(event);
    ctx.fillRect(x0, EVENTS.y, Math.max(x1 - x0, 3), EVENTS.h);
  }
  laneLabel(ctx, "Events", EVENTS.y + EVENTS.h / 2);
}

function draw(ctx: CanvasRenderingContext2D) {
  if (!bb.summary || !tl.ready) {
    return;
  }
  const { width, height } = ctx.canvas;
  const t = theme.value;
  ctx.clearRect(0, 0, width, height);

  drawThrottle(ctx, width);
  drawSaturation(ctx, width);
  drawRth(ctx, width);
  drawEvents(ctx, width);

  // The timeline window, shared with the Timeline page.
  const windowStart = xOfIndex(tl.windowOffset, width);
  const windowEnd = xOfIndex(tl.windowOffset + tl.windowSize, width);
  ctx.fillStyle = t.selection;
  ctx.fillRect(windowStart, 0, Math.max(windowEnd - windowStart, 2), height);

  if (hover.value != undefined && hover.value >= GUTTER) {
    const index = indexAt(hover.value, width);
    const bucket = bucketAt(hover.value, width);
    const lines = [formatClock(position.msAt(index))];
    const throttle = strip.value.throttle?.[bucket];
    if (throttle != undefined) {
      lines.push(`Throttle ${(throttle * 100).toFixed(0)}%`);
    }
    const saturation = strip.value.saturation?.[bucket];
    if (saturation) {
      lines.push(`Saturated ${(saturation * 100).toFixed(0)}%`);
    }
    const rth = strip.value.rthState?.[bucket];
    if (rth) {
      lines.push(`${nav.value?.name ?? "RTH"} ${rthLabels.value[rth] ?? rth}`);
    }
    ctx.strokeStyle = t.ink;
    ctx.beginPath();
    ctx.moveTo(Math.round(hover.value) + 0.5, 0);
    ctx.lineTo(Math.round(hover.value) + 0.5, height);
    ctx.stroke();
    tooltip(ctx, t, hover.value, 8, width, lines);
  }
}

function click(e: MouseEvent) {
  const width = (e.target as HTMLCanvasElement).width;
  if (e.offsetX < GUTTER) {
    return;
  }
  position.jump(indexAt(e.offsetX, width));
}
</script>
