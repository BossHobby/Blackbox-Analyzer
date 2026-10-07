<template>
  <EmptyState v-if="!bb.isLoaded" />
  <div v-else class="flex min-w-0 flex-col gap-3">
    <LogSummary />

    <p
      v-if="!bb.isNavigationDebugLog"
      role="status"
      class="flex items-start gap-2 rounded-lg border border-line bg-panel p-3 text-sm text-muted"
    >
      <Icon name="warning" class="text-warning" />Heading, velocity and RTH
      plots need the Navigation blackbox debug mode. Enable it in the
      Configurator to log them; this log only has GPS and altitude.
    </p>

    <section
      v-if="rthRuns.length"
      :aria-label="phaseTitle"
      class="rounded-lg border border-line bg-panel p-3"
    >
      <div class="mb-1 flex items-baseline justify-between text-sm">
        <h2 class="font-semibold">{{ phaseTitle }}</h2>
        <span class="text-xs text-muted">click a phase to move the cursor</span>
      </div>
      <div class="relative h-7 rounded-sm bg-subtle">
        <button
          v-for="(run, index) in rthRuns"
          :key="index"
          type="button"
          class="absolute inset-y-0 overflow-hidden rounded-sm border-x border-panel px-1 text-left text-xs whitespace-nowrap"
          :class="
            run.failed ? 'bg-danger/25 text-ink' : 'bg-[var(--ui-series-6)]/20'
          "
          :style="{
            left: `${(run.start / range[1]) * 100}%`,
            width: `${((run.end - run.start) / range[1]) * 100}%`,
          }"
          :title="`${run.label} · ${formatClock(position.msAt(run.start))}`"
          @click="select(run.start)"
        >
          {{ run.label }}
        </button>
        <div
          class="pointer-events-none absolute inset-y-0 w-px bg-ink"
          :style="{ left: `${(cursor / range[1]) * 100}%` }"
        />
      </div>
    </section>

    <div class="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <Panel
        title="Map"
        :description="mapDescription"
        class="xl:sticky xl:top-0 xl:self-start"
      >
        <template #actions>
          <Segmented
            v-model="tiles"
            label="Basemap"
            :options="[
              { value: 'off', label: 'No basemap' },
              { value: 'streets', label: 'Streets' },
              { value: 'satellite', label: 'Satellite' },
            ]"
          />
        </template>
        <div v-if="bb.hasGps" class="h-[620px]">
          <NavMap
            :tiles="tiles"
            :cursor="cursor"
            :hover="hover"
            @select="select"
          />
        </div>
        <p v-else class="text-sm text-muted">
          This log has no GPS fix, so there is no track to draw.
        </p>
      </Panel>

      <Panel
        title="Navigation"
        description="Hover to scrub the map; click to move the shared cursor."
      >
        <template #actions>
          <UiButton @click="position.jump(cursor)">Open in Timeline</UiButton>
        </template>
        <div class="flex flex-col gap-4">
          <NavPlot
            v-for="(plot, index) in plots"
            :key="plot.title"
            v-model:hover="hover"
            v-bind="plot"
            :range="range"
            :cursor="cursor"
            :bands="rthBands"
            :axis="index == plots.length - 1"
            @select="select"
          />
        </div>
      </Panel>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  formatClock,
  useBlackboxStore,
  type BlackboxAxisDef,
} from "@/stores/blackbox";
import { useTimelineStore } from "@/stores/timeline";
import EmptyState from "@/components/EmptyState.vue";
import LogSummary from "@/components/LogSummary.vue";
import Panel from "@/components/ui/Panel.vue";
import Icon from "@/components/ui/Icon.vue";
import UiButton from "@/components/ui/Button.vue";
import Segmented from "@/components/ui/Segmented.vue";
import NavMap from "@/components/nav/NavMap.vue";
import NavPlot from "@/components/nav/NavPlot.vue";
import type { NavSeries } from "@/components/nav/types";
import {
  readTileProvider,
  saveTileProvider,
  type TileProvider,
} from "@/components/nav/tiles";
import { useLogPosition } from "@/ui/useJump";
import { navigationStates } from "@/log/profile";

// Navigation debug slots, see the firmware's blackbox_set_debug() call sites.
// Slots 0-3, 7 and 8 are shared; the rest differ between multi and wing.
const NAV = {
  heading: 0,
  gpsHeading: 1,
  confidence: 3,
  state: 4,
  correctionFlags: 7,
  // multi/navigation.cpp
  homeDistance: 5,
  headingError: 9,
  desiredNorth: 10,
  desiredEast: 11,
  gpsNorth: 12,
  gpsEast: 13,
  overridePitch: 14,
  overrideRoll: 15,
  // wing/navigation.cpp
  circleDistance: 5,
  altitudeError: 6,
  commandPitch: 14,
  commandRoll: 15,
};

const bb = useBlackboxStore();
const tl = useTimelineStore();
const position = useLogPosition();

const tiles = ref<TileProvider>(readTileProvider());
watch(tiles, saveTileProvider);

const hover = ref<number>();
const cursor = computed(() => position.cursorIndex());
const range = computed<[number, number]>(() => [0, bb.entryCount]);

function select(index: number) {
  tl.setCursor(position.msAt(index));
}

function debugDef(slot: number): BlackboxAxisDef {
  const field = bb.fields.debug;
  return { ...field, ...field?.axisDefs?.[slot] };
}

function debugSeries(
  slot: number,
  label: string,
  extra: Partial<NavSeries> = {},
) {
  return { column: `debug_${slot}`, label, def: debugDef(slot), ...extra };
}

const nav = computed(() => navigationStates(bb.profile));
const isWing = computed(() => bb.vehicleLabel == "Wing");
const phaseTitle = computed(() =>
  nav.value?.name == "RTH" ? "RTH phases" : "Navigation phases",
);

const rthRuns = computed(() => {
  const column = nav.value ? bb.entries[`debug_${NAV.state}`] : undefined;
  const labels = nav.value?.labels ?? [];
  const runs: {
    start: number;
    end: number;
    state: number;
    label: string;
    failed: boolean;
  }[] = [];
  if (!column) return runs;
  let start = 0;
  for (let i = 1; i <= column.length; i++) {
    if (i < column.length && column[i] == column[start]) continue;
    const state = column[start];
    if (state) {
      runs.push({
        start,
        end: i,
        state,
        label: labels[state] ?? `State ${state}`,
        failed: !!nav.value?.failures.has(state),
      });
    }
    start = i;
  }
  return runs;
});

// Merged spans where any RTH phase is active, shaded behind every plot.
const rthBands = computed(() => {
  const bands: [number, number][] = [];
  for (const run of rthRuns.value) {
    const last = bands[bands.length - 1];
    if (last && run.start <= last[1]) last[1] = run.end;
    else bands.push([run.start, run.end]);
  }
  return bands;
});

const plots = computed(() => {
  const plots: {
    title: string;
    series: NavSeries[];
    flags?: { column: string; names: string[] };
    yRange?: [number, number];
    height?: number;
  }[] = [];

  if (bb.isNavigationDebugLog) {
    plots.push(
      {
        title: "Heading (deg)",
        series: [
          debugSeries(NAV.heading, "IMU", { wrap: 360 }),
          debugSeries(NAV.gpsHeading, "GPS course", { wrap: 360 }),
        ],
        yRange: [0, 360],
      },
      {
        title: "Heading confidence (%) and correction blocks",
        series: [debugSeries(NAV.confidence, "Confidence")],
        flags: {
          column: `debug_${NAV.correctionFlags}`,
          names: debugDef(NAV.correctionFlags).flags ?? [],
        },
        yRange: [0, 100],
        height: 80 + 8 * 12,
      },
    );
  }

  if (bb.isNavigationDebugLog && isWing.value) {
    plots.push(
      {
        title: "Distance from circle centre (m)",
        series: [debugSeries(NAV.circleDistance, "Distance")],
        height: 90,
      },
      {
        title: "Altitude error (m, target minus actual)",
        series: [debugSeries(NAV.altitudeError, "Error")],
        height: 90,
      },
      {
        title: "Navigation attitude command (deg)",
        series: [
          debugSeries(NAV.commandPitch, "Pitch"),
          debugSeries(NAV.commandRoll, "Roll"),
        ],
      },
    );
  } else if (bb.isNavigationDebugLog && !bb.isRoverLog) {
    plots.push(
      {
        title: "Heading error (deg)",
        series: [debugSeries(NAV.headingError, "Error")],
        height: 90,
      },
      {
        title: "Velocity north (m/s)",
        series: [
          debugSeries(NAV.desiredNorth, "Desired"),
          debugSeries(NAV.gpsNorth, "GPS"),
        ],
      },
      {
        title: "Velocity east (m/s)",
        series: [
          debugSeries(NAV.desiredEast, "Desired"),
          debugSeries(NAV.gpsEast, "GPS"),
        ],
      },
      {
        title: "Distance from home (m)",
        series: [debugSeries(NAV.homeDistance, "Distance")],
        height: 90,
      },
    );
  }

  const altitude = bb.fields.altitude;
  if (altitude && bb.entries.altitude) {
    plots.push({
      title: "Altitude (m)",
      series: [{ column: "altitude", label: "Altitude", def: altitude }],
      height: 90,
    });
  }

  if (bb.isNavigationDebugLog && !isWing.value && !bb.isRoverLog) {
    plots.push({
      title: "Navigation stick override",
      series: [
        debugSeries(NAV.overridePitch, "Pitch"),
        debugSeries(NAV.overrideRoll, "Roll"),
      ],
      height: 90,
    });
  }
  return plots;
});

const mapDescription = computed(() =>
  tiles.value == "off"
    ? "Track only. A basemap loads tiles from a third-party server, which sees the flight area."
    : "Basemap tiles are loaded from a third-party server.",
);
</script>
