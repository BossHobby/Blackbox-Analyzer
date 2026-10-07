<template>
  <div class="relative size-full">
    <div
      ref="container"
      class="nav-map size-full rounded-md"
      role="application"
      aria-label="Flight track map"
    />
    <ul
      class="pointer-events-none absolute top-2 right-2 z-[400] flex gap-3 rounded-md border border-line bg-panel/90 px-2 py-1 text-xs"
      aria-label="Legend"
    >
      <li class="flex items-center gap-1.5">
        <span
          class="h-0.5 w-3 rounded-full"
          :style="{ background: theme.series[0] }"
        />Track
      </li>
      <li v-if="hasRth" class="flex items-center gap-1.5">
        <span
          class="h-0.5 w-3 rounded-full"
          :style="{ background: theme.series[5] }"
        />RTH active
      </li>
      <li v-if="home" class="flex items-center gap-1.5">
        <span class="size-2 bg-ink" />Home
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useBlackboxStore } from "@/stores/blackbox";
import { useChartTheme } from "@/ui/useChartTheme";
import { TILE_PROVIDERS, type TileProvider } from "./tiles";

const props = defineProps<{
  tiles: TileProvider;
  cursor: number;
  hover?: number;
}>();
const emit = defineEmits<{ select: [index: number] }>();

const MAX_POINTS = 5000;
// Small quads stay within a few hundred meters; allow zooming past the tiles.
const MAX_ZOOM = 22;

const bb = useBlackboxStore();
const theme = useChartTheme();
const container = ref<HTMLElement>();

let map: L.Map | undefined;
let tileLayer: L.TileLayer | undefined;
let trackLayer: L.LayerGroup | undefined;
let craft: L.CircleMarker | undefined;

// Fixed GPS samples, decimated, as [lat, lon, frame index, rth active].
const points = computed(() => {
  const lat = bb.entries.gps_coord_0;
  const lon = bb.entries.gps_coord_1;
  const rth = bb.isNavigationDebugLog ? bb.entries.debug_4 : undefined;
  if (!lat || !lon) return [];
  const fixed: number[] = [];
  for (let i = 0; i < lat.length; i++) {
    if (lat[i] != 0 || lon[i] != 0) fixed.push(i);
  }
  const step = Math.max(Math.ceil(fixed.length / MAX_POINTS), 1);
  const out: { latlng: L.LatLngTuple; index: number; rth: boolean }[] = [];
  for (let n = 0; n < fixed.length; n += step) {
    const i = fixed[n];
    out.push({
      latlng: [lat[i] * 1e-7, lon[i] * 1e-7],
      index: i,
      rth: !!rth?.[i],
    });
  }
  return out;
});

const hasRth = computed(() => points.value.some((p) => p.rth));

const home = computed<L.LatLngTuple | undefined>(() => {
  const lat = bb.entries.gps_home_0;
  const lon = bb.entries.gps_home_1;
  if (!lat || !lon) return undefined;
  const last = lat.length - 1;
  return lat[last] || lon[last]
    ? [lat[last] * 1e-7, lon[last] * 1e-7]
    : undefined;
});

// Point nearest in time to a frame index (points are sorted by index).
function pointAt(index: number) {
  const list = points.value;
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].index < index) lo = mid + 1;
    else hi = mid;
  }
  return list[lo];
}

function drawTrack() {
  if (!map) return;
  trackLayer?.remove();
  trackLayer = L.layerGroup().addTo(map);
  const t = theme.value;

  // One polyline per run of RTH state, so returns stand out.
  let run: L.LatLngTuple[] = [];
  let runRth = points.value[0]?.rth ?? false;
  const flush = () => {
    if (run.length > 1) {
      L.polyline(run, {
        color: runRth ? t.series[5] : t.series[0],
        weight: 3,
        interactive: false,
      }).addTo(trackLayer!);
    }
  };
  for (const point of points.value) {
    if (point.rth != runRth) {
      run.push(point.latlng);
      flush();
      run = [point.latlng];
      runRth = point.rth;
    } else {
      run.push(point.latlng);
    }
  }
  flush();

  if (home.value) {
    L.marker(home.value, {
      interactive: false,
      icon: L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;background:${t.ink};border:2px solid ${t.panel}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
    }).addTo(trackLayer);
  }

  craft = L.circleMarker([0, 0], {
    radius: 6,
    color: t.panel,
    weight: 2,
    fillColor: t.accent,
    fillOpacity: 1,
    interactive: false,
  }).addTo(trackLayer);
  moveCraft();
}

function moveCraft() {
  if (!craft || !points.value.length) return;
  const point = pointAt(props.hover ?? props.cursor);
  craft.setLatLng(point.latlng);
}

function setTiles() {
  if (!map) return;
  tileLayer?.remove();
  tileLayer = undefined;
  const provider = TILE_PROVIDERS[props.tiles];
  if (provider) {
    tileLayer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      maxNativeZoom: provider.maxZoom,
      maxZoom: MAX_ZOOM,
    }).addTo(map);
  }
}

function fit() {
  if (!map || !points.value.length) return;
  const bounds = L.latLngBounds(points.value.map((p) => p.latlng));
  if (home.value) bounds.extend(home.value);
  map.fitBounds(bounds, { padding: [24, 24] });
}

onMounted(() => {
  map = L.map(container.value!, {
    // Whole zoom levels keep raster tiles crisp and seam-free.
    zoomSnap: 1,
    attributionControl: true,
    maxZoom: MAX_ZOOM,
  });
  map.attributionControl.setPrefix(false);
  map.on("click", (e: L.LeafletMouseEvent) => {
    // Select the track point nearest to the click, within 16 px.
    let best: { index: number; distance: number } | undefined;
    const clicked = e.containerPoint;
    for (const point of points.value) {
      const distance = map!
        .latLngToContainerPoint(point.latlng)
        .distanceTo(clicked);
      if (distance < 16 && (!best || distance < best.distance)) {
        best = { index: point.index, distance };
      }
    }
    if (best) emit("select", best.index);
  });
  setTiles();
  drawTrack();
  fit();
});

onUnmounted(() => {
  map?.remove();
  map = undefined;
});

watch(() => props.tiles, setTiles);
watch([points, theme], () => {
  drawTrack();
});
watch(points, fit);
watch(() => [props.cursor, props.hover], moveCraft);
</script>

<style>
.nav-map.leaflet-container {
  background: var(--ui-subtle);
  font: inherit;
}
.nav-map .leaflet-control-attribution {
  background: color-mix(in srgb, var(--ui-panel) 85%, transparent);
  color: var(--ui-muted);
}
.nav-map .leaflet-control-attribution a {
  color: var(--ui-ink);
}
.nav-map .leaflet-bar a {
  background: var(--ui-panel);
  color: var(--ui-ink);
  border-color: var(--ui-line);
}
</style>
