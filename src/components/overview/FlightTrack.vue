<template>
  <div
    class="h-[320px] cursor-pointer"
    role="img"
    :aria-label="`GPS track, up to ${track.maxDistance.toFixed(0)} m from ${track.hasHome ? 'home' : 'the first fix'}`"
    @mouseleave="hover = undefined"
  >
    <CanvasComponent
      @draw="draw"
      @mousemove="(e: MouseEvent) => (hover = [e.offsetX, e.offsetY])"
      @click="click"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import CanvasComponent from "@/components/CanvasComponent.vue";
import { formatClock, useBlackboxStore } from "@/stores/blackbox";
import { monoFont, tooltip } from "@/analysis/render";
import { useChartTheme } from "@/ui/useChartTheme";
import { useLogPosition } from "@/ui/useJump";

const PAD = 24;
const HIT_RADIUS = 12;
const RING_STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

const bb = useBlackboxStore();
const theme = useChartTheme();
const position = useLogPosition();
const hover = ref<[number, number]>();

const track = computed(() => bb.summary!.track!);

// Equal-scale projection: north up, east right, fitted around the origin.
function projection(width: number, height: number) {
  const { north, east } = track.value;
  let minN = 0,
    maxN = 0,
    minE = 0,
    maxE = 0;
  for (let i = 0; i < north.length; i++) {
    minN = Math.min(minN, north[i]);
    maxN = Math.max(maxN, north[i]);
    minE = Math.min(minE, east[i]);
    maxE = Math.max(maxE, east[i]);
  }
  const span = Math.max(maxE - minE, maxN - minN, 1);
  const scale = Math.min(width - 2 * PAD, height - 2 * PAD) / span;
  const cx = width / 2 - ((minE + maxE) / 2) * scale;
  const cy = height / 2 + ((minN + maxN) / 2) * scale;
  return {
    scale,
    x: (e: number) => cx + e * scale,
    y: (n: number) => cy - n * scale,
  };
}

function nearestPoint(px: number, py: number, width: number, height: number) {
  const p = projection(width, height);
  const { north, east } = track.value;
  let best = -1;
  let bestDistance = HIT_RADIUS;
  for (let i = 0; i < north.length; i++) {
    const d = Math.hypot(p.x(east[i]) - px, p.y(north[i]) - py);
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  }
  return best;
}

// Track point closest in time to a frame index (track.index is sorted).
function pointAtIndex(index: number) {
  const indices = track.value.index;
  let lo = 0;
  let hi = indices.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (indices[mid] < index) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function marker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = theme.value.panel;
  ctx.stroke();
  ctx.lineWidth = 1;
}

function draw(ctx: CanvasRenderingContext2D) {
  if (!bb.summary?.track) {
    return;
  }
  const { width, height } = ctx.canvas;
  const t = theme.value;
  const p = projection(width, height);
  const { north, east } = track.value;
  ctx.clearRect(0, 0, width, height);

  // Distance rings around the origin: about four per view.
  const ring =
    RING_STEPS.find(
      (step) => step * p.scale * 2 >= Math.min(width, height) / 4,
    ) ?? RING_STEPS[RING_STEPS.length - 1];
  ctx.strokeStyle = t.grid;
  ctx.fillStyle = t.text;
  ctx.font = monoFont(10);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  for (let r = ring; r <= track.value.maxDistance + ring; r += ring) {
    ctx.beginPath();
    ctx.arc(p.x(0), p.y(0), r * p.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(`${r} m`, p.x(0) + 3, p.y(0) - r * p.scale - 2);
  }

  ctx.beginPath();
  for (let i = 0; i < north.length; i++) {
    if (i == 0) ctx.moveTo(p.x(east[i]), p.y(north[i]));
    else ctx.lineTo(p.x(east[i]), p.y(north[i]));
  }
  ctx.strokeStyle = t.series[0];
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.lineWidth = 1;

  // Home (or first fix) as a square, the shared timeline cursor as a dot.
  ctx.fillStyle = t.ink;
  ctx.fillRect(p.x(0) - 5, p.y(0) - 5, 10, 10);
  ctx.textBaseline = "top";
  ctx.font = monoFont(11);
  ctx.fillText(
    track.value.hasHome ? "Home" : "First fix",
    p.x(0) + 8,
    p.y(0) + 4,
  );

  const cursor = pointAtIndex(position.cursorIndex());
  marker(ctx, p.x(east[cursor]), p.y(north[cursor]), t.accent);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = t.text;
  ctx.fillText("N ↑", 8, 8);

  if (hover.value) {
    const point = nearestPoint(hover.value[0], hover.value[1], width, height);
    if (point >= 0) {
      const x = p.x(east[point]);
      const y = p.y(north[point]);
      marker(ctx, x, y, t.ink);
      tooltip(ctx, t, x, Math.max(y - 40, 4), width, [
        formatClock(position.msAt(track.value.index[point])),
        `${Math.hypot(north[point], east[point]).toFixed(0)} m from ${track.value.hasHome ? "home" : "first fix"}`,
      ]);
    }
  }
}

function click(e: MouseEvent) {
  const canvas = e.target as HTMLCanvasElement;
  const point = nearestPoint(e.offsetX, e.offsetY, canvas.width, canvas.height);
  if (point >= 0) {
    position.jump(track.value.index[point]);
  }
}
</script>
